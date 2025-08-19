import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scans, violations, teams, usageEvents } from '@/lib/db/schema';
import { ComplianceScanner } from '@/lib/scanner/engine';
import { eq } from 'drizzle-orm';

// Rate limiting (simple in-memory for MVP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // 5 scans per minute per IP/email

  const current = rateLimitMap.get(identifier);
  if (!current || now > current.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (current.count >= maxRequests) {
    return false;
  }

  current.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { url, email, tier = 'free' } = await req.json();
    
    // Validate inputs
    if (!url || !email) {
      return NextResponse.json(
        { error: 'URL and email are required' },
        { status: 400 }
      );
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const rateLimitKey = `${clientIP}:${email}`;
    
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in 1 minute.' },
        { status: 429 }
      );
    }

    // Get or create organization (simplified for MVP)
    const domain = new URL(url).hostname;
    
    // Check if organization exists
    let orgResult = await db.select().from(teams).where(eq(teams.stripeCustomerId, email)).limit(1);
    let orgId: number;
    
    if (orgResult.length === 0) {
      // Create new team/organization
      const newOrg = await db.insert(teams).values({
        name: domain,
        planName: tier,
        stripeCustomerId: email // Using this field temporarily for email
      }).returning({ id: teams.id });
      
      orgId = newOrg[0].id;
    } else {
      orgId = orgResult[0].id;
    }

    // Create scan record
    const scanResult = await db.insert(scans).values({
      teamId: orgId,
      url,
      email,
      domain,
      status: 'processing'
    }).returning({ id: scans.id });

    const scanId = scanResult[0].id;

    // Start background scan processing
    processScansInBackground(scanId, url, tier, orgId).catch(error => {
      console.error('Background scan failed:', error);
      // Update scan status to failed
      db.update(scans)
        .set({ 
          status: 'failed', 
          errorMessage: error.message,
          processingTimeMs: Date.now() - startTime
        })
        .where(eq(scans.id, scanId))
        .catch(console.error);
    });

    return NextResponse.json({
      success: true,
      scanId: scanId,
      message: 'Scan started. Results will be ready in ~30 seconds.',
      resultsUrl: `/scan/${scanId}`,
      estimatedTime: tier === 'enterprise' ? '45 seconds' : '30 seconds'
    });

  } catch (error) {
    console.error('Scan API error:', error);
    return NextResponse.json(
      { error: 'Failed to start scan. Please try again.' },
      { status: 500 }
    );
  }
}

async function processScansInBackground(scanId: number, url: string, tier: string, orgId: number) {
  const startTime = Date.now();
  const scanner = new ComplianceScanner();

  try {
    console.log(`🔍 Starting scan ${scanId} for ${url}`);
    
    // Run the compliance scan
    const results = await scanner.scanWebsite({
      url,
      depth: tier === 'enterprise' ? 'deep' : 'standard',
      includeSubpages: ['professional', 'enterprise'].includes(tier),
      maxPages: tier === 'enterprise' ? 10 : 5, // Reduced for serverless
      tier: tier as any
    });

    console.log(`✅ Scan ${scanId} completed with ${results.violations.length} violations`);

    // Store individual violations
    if (results.violations.length > 0) {
      const violationData = results.violations.map(violation => ({
        scanId: scanId,
        wcagCriterion: violation.wcagCriterion,
        severity: violation.severity,
        elementType: violation.elementType,
        elementSelector: violation.elementSelector || '',
        elementHtml: violation.elementHtml?.substring(0, 1000) || '', // Truncate for safety
        pageUrl: violation.pageUrl || url,
        userImpact: violation.userImpact,
        businessImpact: violation.businessImpact || '',
        legalRiskLevel: violation.legalRiskLevel || 'medium',
        fixDescription: violation.fixDescription,
        fixCode: violation.fixCode || '',
        fixEffort: violation.fixEffort || 'moderate',
        estimatedFixTime: violation.estimatedFixTime || '30 minutes',
        aiConfidence: violation.aiConfidence || 0.8
      }));

      await db.insert(violations).values(violationData);
    }

    // Update scan with results
    await db.update(scans)
      .set({
        status: 'complete',
        wcagScore: results.wcagScore,
        adaRiskScore: results.adaRiskScore,
        lawsuitProbability: results.lawsuitProbability.toString(),
        totalViolations: results.violations.length,
        criticalViolations: results.summary.bySeverity.critical,
        seriousViolations: results.summary.bySeverity.serious,
        moderateViolations: results.summary.bySeverity.moderate,
        minorViolations: results.summary.bySeverity.minor,
        violations: results.violations, // Store full violations as JSON
        aiAnalysis: results.aiAnalysis || null,
        recommendations: results.aiAnalysis?.prioritizedFixes || null,
        legalAssessment: results.aiAnalysis?.legalRiskAssessment || null,
        processingTimeMs: Date.now() - startTime,
        completedAt: new Date()
      })
      .where(eq(scans.id, scanId));

    // Track usage for billing
    await db.insert(usageEvents).values({
      teamId: orgId,
      eventType: 'page_scan',
      count: 1,
      metadata: { 
        scanId, 
        url, 
        tier, 
        violationsFound: results.violations.length,
        processingTimeMs: Date.now() - startTime
      }
    });

    console.log(`📊 Scan ${scanId} stored successfully`);

  } catch (error) {
    console.error(`❌ Scan ${scanId} processing failed:`, error);
    
    await db.update(scans)
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTimeMs: Date.now() - startTime
      })
      .where(eq(scans.id, scanId));
    
    throw error;
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    scanner: 'ready'
  });
}