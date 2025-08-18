import { NextRequest, NextResponse } from 'next/server';
import { ComplianceScanner } from '../../scanner/engine';
import { LLMComplianceAnalyzer } from '../../analyzer/llm-analyzer';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Request validation schema
const scanRequestSchema = z.object({
  url: z.string().url(),
  scanType: z.enum(['surface', 'interactive', 'exhaustive']).default('interactive'),
  wcagLevel: z.enum(['A', 'AA', 'AAA']).default('AA'),
  userId: z.string().uuid().optional(),
  email: z.string().email().optional()
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = scanRequestSchema.parse(body);
    
    // Check user subscription limits if userId provided
    if (validatedData.userId) {
      const { data: user, error } = await supabase
        .from('organizations')
        .select('subscription_tier, scans_this_month')
        .eq('id', validatedData.userId)
        .single();

      if (error) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }

      const scanLimits: Record<string, number> = {
        free: 1,
        starter: 50,
        pro: 500,
        enterprise: Infinity
      };

      const limit = scanLimits[user.subscription_tier] || 1;
      
      if (user.scans_this_month >= limit) {
        return NextResponse.json(
          { 
            error: 'Scan limit reached',
            upgradeUrl: '/pricing',
            currentUsage: user.scans_this_month,
            limit
          },
          { status: 402 }
        );
      }

      // Increment scan count
      await supabase
        .from('organizations')
        .update({ scans_this_month: user.scans_this_month + 1 })
        .eq('id', validatedData.userId);
    }

    // Create scan record
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        organization_id: validatedData.userId,
        url: validatedData.url,
        scan_type: validatedData.scanType,
        wcag_level: validatedData.wcagLevel,
        status: 'pending'
      })
      .select()
      .single();

    if (scanError) {
      return NextResponse.json(
        { error: 'Failed to create scan record' },
        { status: 500 }
      );
    }

    // Queue the scan for async processing
    queueScan(scan.id, validatedData).catch(console.error);

    return NextResponse.json({
      scanId: scan.id,
      status: 'queued',
      estimatedTime: getEstimatedTime(validatedData.scanType),
      statusUrl: `/api/scan/${scan.id}/status`,
      resultsUrl: `/api/scan/${scan.id}/results`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Scan initiation failed:', error);
    return NextResponse.json(
      { error: 'Failed to initiate scan' },
      { status: 500 }
    );
  }
}

async function queueScan(scanId: string, config: z.infer<typeof scanRequestSchema>) {
  try {
    // Update status to scanning
    await supabase
      .from('scans')
      .update({ 
        status: 'scanning',
        started_at: new Date().toISOString()
      })
      .eq('id', scanId);

    // Initialize scanner and analyzer
    const scanner = new ComplianceScanner();
    const analyzer = new LLMComplianceAnalyzer();
    
    // Execute scan
    console.log(`Starting scan ${scanId} for ${config.url}`);
    const scanResults = await scanner.scanWebsite({
      url: config.url,
      depth: config.scanType,
      wcagLevel: config.wcagLevel,
      includeSubpages: config.scanType === 'exhaustive',
      maxPages: config.scanType === 'exhaustive' ? 50 : 1
    });

    // Update status to analyzing
    await supabase
      .from('scans')
      .update({ status: 'analyzing' })
      .eq('id', scanId);

    // Analyze with LLM for context
    const llmAnalysis = await analyzer.analyzeForCompliance(
      scanResults.elements,
      scanResults.violations
    );

    // Combine violations
    const allViolations = [
      ...scanResults.violations,
      ...llmAnalysis.contextualViolations.filter(v => !v.falsePositive)
    ];

    // Calculate compliance score
    const complianceScore = calculateComplianceScore(allViolations, scanResults.elements.length);

    // Get company info for risk assessment
    const companyInfo = await getCompanyInfo(config.url);
    
    // Calculate lawsuit risk
    const riskAssessment = await analyzer.generateLawsuitRiskAssessment(
      allViolations,
      companyInfo
    );

    // Store detailed results
    await storeResults(scanId, scanResults, llmAnalysis, riskAssessment, complianceScore);

    // Update scan completion
    const processingTime = Date.now() - new Date(scanResults.timestamp).getTime();
    await supabase
      .from('scans')
      .update({
        status: 'complete',
        completed_at: new Date().toISOString(),
        compliance_score: complianceScore,
        lawsuit_risk_score: riskAssessment.lawsuitProbability,
        total_violations: allViolations.length,
        critical_violations: allViolations.filter(v => v.severity === 'critical').length,
        serious_violations: allViolations.filter(v => v.severity === 'serious').length,
        moderate_violations: allViolations.filter(v => v.severity === 'moderate').length,
        minor_violations: allViolations.filter(v => v.severity === 'minor').length,
        elements_analyzed: scanResults.elements.length,
        processing_time_ms: processingTime,
        scan_results: scanResults
      })
      .eq('id', scanId);

    // Check for alerts
    await checkAndSendAlerts(scanId, allViolations, complianceScore, riskAssessment);

    console.log(`Scan ${scanId} completed successfully`);

  } catch (error) {
    console.error(`Scan ${scanId} failed:`, error);
    
    await supabase
      .from('scans')
      .update({ 
        status: 'failed',
        completed_at: new Date().toISOString()
      })
      .eq('id', scanId);
  }
}

async function storeResults(
  scanId: string,
  scanResults: any,
  llmAnalysis: any,
  riskAssessment: any,
  complianceScore: number
) {
  // Store violations
  const violations = [...scanResults.violations, ...llmAnalysis.contextualViolations];
  
  for (const violation of violations) {
    await supabase
      .from('violations')
      .insert({
        scan_id: scanId,
        wcag_criterion: violation.wcagCriterion || violation.rule,
        severity: violation.severity,
        element_selector: violation.element,
        element_html: violation.html?.substring(0, 1000),
        page_url: scanResults.url,
        description: violation.message,
        user_impact: violation.impact,
        legal_risk: violation.legalRisk,
        lawsuit_probability: violation.lawsuitProbability,
        fix_description: violation.howToFix,
        fix_code: violation.codeExample,
        auto_fixable: violation.severity !== 'critical'
      });
  }

  // Store lawsuit risk assessment
  await supabase
    .from('lawsuit_risks')
    .insert({
      scan_id: scanId,
      overall_risk_score: riskAssessment.lawsuitProbability,
      lawsuit_probability: riskAssessment.lawsuitProbability,
      estimated_settlement_min: riskAssessment.estimatedSettlement.min,
      estimated_settlement_max: riskAssessment.estimatedSettlement.max,
      serial_plaintiff_score: riskAssessment.serialPlaintiffScore,
      similar_case_defendant: riskAssessment.similarCase.defendant,
      similar_case_settlement: riskAssessment.similarCase.settlement,
      similar_violations: riskAssessment.similarCase.violations,
      immediate_actions: riskAssessment.recommendedActions.immediate,
      urgent_actions: riskAssessment.recommendedActions.urgent,
      standard_actions: riskAssessment.recommendedActions.standard
    });

  // Store scan history
  const { data: scanData } = await supabase
    .from('scans')
    .select('organization_id')
    .eq('id', scanId)
    .single();

  if (scanData?.organization_id) {
    await supabase
      .from('scan_history')
      .insert({
        organization_id: scanData.organization_id,
        scan_id: scanId,
        compliance_score: complianceScore,
        violation_count: violations.length
      });
  }
}

async function checkAndSendAlerts(
  scanId: string,
  violations: any[],
  complianceScore: number,
  riskAssessment: any
) {
  const { data: scan } = await supabase
    .from('scans')
    .select('organization_id, url')
    .eq('id', scanId)
    .single();

  if (!scan?.organization_id) return;

  // Check for critical violations
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  if (criticalViolations.length > 0) {
    await supabase
      .from('alerts')
      .insert({
        organization_id: scan.organization_id,
        type: 'new_violation',
        severity: 'critical',
        title: `${criticalViolations.length} Critical Accessibility Violations Found`,
        message: `Your scan of ${scan.url} found ${criticalViolations.length} critical violations that need immediate attention.`,
        data: { scanId, violations: criticalViolations.slice(0, 5) }
      });
  }

  // Check for high lawsuit risk
  if (riskAssessment.lawsuitProbability > 70) {
    await supabase
      .from('alerts')
      .insert({
        organization_id: scan.organization_id,
        type: 'lawsuit_risk',
        severity: 'critical',
        title: 'High Lawsuit Risk Detected',
        message: `Your website has a ${riskAssessment.lawsuitProbability}% chance of ADA lawsuit. Immediate action recommended.`,
        data: { scanId, riskAssessment }
      });
  }

  // Check for score drop
  const { data: previousScans } = await supabase
    .from('scan_history')
    .select('compliance_score')
    .eq('organization_id', scan.organization_id)
    .order('created_at', { ascending: false })
    .limit(2);

  if (previousScans && previousScans.length === 2) {
    const scoreDrop = previousScans[1].compliance_score - complianceScore;
    if (scoreDrop > 10) {
      await supabase
        .from('alerts')
        .insert({
          organization_id: scan.organization_id,
          type: 'score_drop',
          severity: 'serious',
          title: 'Compliance Score Dropped',
          message: `Your compliance score dropped by ${scoreDrop} points to ${complianceScore}.`,
          data: { scanId, previousScore: previousScans[1].compliance_score, currentScore: complianceScore }
        });
    }
  }
}

function calculateComplianceScore(violations: any[], totalElements: number): number {
  if (totalElements === 0) return 0;
  
  let penaltyPoints = 0;
  
  violations.forEach(violation => {
    switch (violation.severity) {
      case 'critical':
        penaltyPoints += 10;
        break;
      case 'serious':
        penaltyPoints += 5;
        break;
      case 'moderate':
        penaltyPoints += 2;
        break;
      case 'minor':
        penaltyPoints += 1;
        break;
    }
  });
  
  const score = Math.max(0, 100 - penaltyPoints);
  return Math.round(score);
}

async function getCompanyInfo(url: string): Promise<any> {
  const domain = new URL(url).hostname.replace('www.', '');
  
  // In production, this would lookup real company data
  return {
    domain,
    industry: 'Technology',
    estimatedRevenue: '$10M-50M',
    userBase: '100K-500K users',
    location: 'United States'
  };
}

function getEstimatedTime(scanType: string): string {
  switch (scanType) {
    case 'surface':
      return '30-60 seconds';
    case 'interactive':
      return '2-5 minutes';
    case 'exhaustive':
      return '10-20 minutes';
    default:
      return '2-5 minutes';
  }
}

// GET endpoint to check scan status
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scanId = url.searchParams.get('scanId');
  
  if (!scanId) {
    return NextResponse.json(
      { error: 'Scan ID required' },
      { status: 400 }
    );
  }

  const { data: scan, error } = await supabase
    .from('scans')
    .select(`
      *,
      violations (count),
      lawsuit_risks (*)
    `)
    .eq('id', scanId)
    .single();

  if (error || !scan) {
    return NextResponse.json(
      { error: 'Scan not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(scan);
}