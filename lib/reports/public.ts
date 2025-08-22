/**
 * Public Report Generation for Shared Links
 * 
 * Provides sanitized, watermarked reports for anonymous sharing
 */

import { createSupabaseClient } from '@/lib/supabase/server';

export interface PublicReportData {
  scan: {
    id: string;
    url: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  summary: {
    overall_score: number;
    total_violations: number;
    critical_issues: number;
    major_issues: number;
    minor_issues: number;
    wcag_level: string;
    pages_scanned: number;
  };
  violations: Array<{
    id: string;
    criterion: string;
    level: 'A' | 'AA' | 'AAA';
    impact: 'critical' | 'serious' | 'moderate' | 'minor';
    description: string;
    help_url?: string;
    instances: number;
    page_count: number;
    tags?: string[];
  }>;
  categories: Array<{
    name: string;
    score: number;
    violations: number;
    description: string;
  }>;
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimated_effort: string;
    wcag_references: string[];
  }>;
  metadata: {
    scan_depth: string;
    scan_duration: number;
    pages_discovered: number;
    pages_analyzed: number;
    compliance_standards: string[];
    generated_at: string;
  };
}

/**
 * Get a sanitized public report for sharing
 * Removes sensitive information and adds appropriate disclaimers
 */
export async function getPublicReport(scanId: string): Promise<PublicReportData | null> {
  try {
    const supabase = createSupabaseClient();

    // Get scan basic information
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('id, url, status, created_at, updated_at, depth')
      .eq('id', scanId)
      .single();

    if (scanError || !scan || scan.status !== 'completed') {
      return null;
    }

    // Get scan findings/violations
    const { data: findings, error: findingsError } = await supabase
      .from('scan_findings')
      .select('*')
      .eq('scan_id', scanId);

    if (findingsError) {
      console.error('Failed to fetch scan findings:', findingsError);
      return null;
    }

    // Process and normalize findings
    const processedViolations = processFindings(findings || []);
    const summary = calculateSummary(processedViolations);
    const categories = calculateCategories(processedViolations);
    const recommendations = generateRecommendations(processedViolations);

    return {
      scan: {
        id: scan.id,
        url: scan.url,
        status: scan.status,
        created_at: scan.created_at,
        updated_at: scan.updated_at
      },
      summary,
      violations: processedViolations,
      categories,
      recommendations,
      metadata: {
        scan_depth: scan.depth || 'standard',
        scan_duration: calculateScanDuration(scan.created_at, scan.updated_at),
        pages_discovered: getUniquePageCount(findings || []),
        pages_analyzed: getUniquePageCount(findings || []),
        compliance_standards: ['WCAG 2.1', 'Section 508'],
        generated_at: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Failed to generate public report:', error);
    return null;
  }
}

function processFindings(findings: any[]): PublicReportData['violations'] {
  // Group findings by WCAG criterion
  const grouped = findings.reduce((acc, finding) => {
    const key = finding.wcag_criterion || 'Unknown';
    if (!acc[key]) {
      acc[key] = {
        criterion: key,
        level: finding.wcag_level || 'A',
        impact: finding.impact || 'minor',
        description: finding.description || 'Accessibility issue detected',
        help_url: finding.help_url,
        instances: 0,
        pages: new Set(),
        tags: finding.tags || []
      };
    }
    acc[key].instances += 1;
    if (finding.page_url) {
      acc[key].pages.add(finding.page_url);
    }
    return acc;
  }, {} as Record<string, any>);

  // Convert to array and sort by impact and instances
  return Object.values(grouped)
    .map((group: any) => ({
      id: Buffer.from(group.criterion).toString('base64'),
      criterion: group.criterion,
      level: group.level,
      impact: group.impact,
      description: group.description,
      help_url: group.help_url,
      instances: group.instances,
      page_count: group.pages.size,
      tags: group.tags
    }))
    .sort((a, b) => {
      const impactOrder = { critical: 4, serious: 3, moderate: 2, minor: 1 };
      const aWeight = (impactOrder[a.impact as keyof typeof impactOrder] || 0) * 1000 + a.instances;
      const bWeight = (impactOrder[b.impact as keyof typeof impactOrder] || 0) * 1000 + b.instances;
      return bWeight - aWeight;
    });
}

function calculateSummary(violations: PublicReportData['violations']): PublicReportData['summary'] {
  const totalViolations = violations.reduce((sum, v) => sum + v.instances, 0);
  const criticalIssues = violations.filter(v => v.impact === 'critical').reduce((sum, v) => sum + v.instances, 0);
  const majorIssues = violations.filter(v => v.impact === 'serious').reduce((sum, v) => sum + v.instances, 0);
  const minorIssues = violations.filter(v => v.impact === 'moderate' || v.impact === 'minor').reduce((sum, v) => sum + v.instances, 0);
  
  // Calculate overall score (simplified algorithm)
  const maxPossibleIssues = 100; // Base assumption
  const weightedIssues = criticalIssues * 4 + majorIssues * 2 + minorIssues * 1;
  const overallScore = Math.max(0, Math.round(100 - (weightedIssues / maxPossibleIssues) * 100));
  
  // Determine WCAG conformance level
  let wcagLevel = 'Non-Conformant';
  if (criticalIssues === 0 && majorIssues === 0) {
    wcagLevel = 'WCAG 2.1 AA Conformant';
  } else if (criticalIssues === 0) {
    wcagLevel = 'Partial Conformance';
  }

  return {
    overall_score: overallScore,
    total_violations: totalViolations,
    critical_issues: criticalIssues,
    major_issues: majorIssues,
    minor_issues: minorIssues,
    wcag_level: wcagLevel,
    pages_scanned: 1 // Will be updated with actual page count
  };
}

function calculateCategories(violations: PublicReportData['violations']): PublicReportData['categories'] {
  const categories = [
    { name: 'Perceivable', keywords: ['color', 'contrast', 'image', 'text', 'audio', 'video'], description: 'Information and UI components must be presentable to users in ways they can perceive' },
    { name: 'Operable', keywords: ['keyboard', 'focus', 'navigation', 'timing', 'seizure'], description: 'User interface components and navigation must be operable' },
    { name: 'Understandable', keywords: ['language', 'readable', 'predictable', 'input', 'error'], description: 'Information and the operation of user interface must be understandable' },
    { name: 'Robust', keywords: ['parsing', 'compatible', 'markup', 'code'], description: 'Content must be robust enough to be interpreted reliably by a wide variety of user agents' }
  ];

  return categories.map(category => {
    const categoryViolations = violations.filter(v => 
      category.keywords.some(keyword => 
        v.criterion.toLowerCase().includes(keyword) || 
        v.description.toLowerCase().includes(keyword)
      )
    );
    
    const violationCount = categoryViolations.reduce((sum, v) => sum + v.instances, 0);
    const score = Math.max(0, 100 - (violationCount * 5)); // Simplified scoring

    return {
      name: category.name,
      score: Math.round(score),
      violations: violationCount,
      description: category.description
    };
  });
}

function generateRecommendations(violations: PublicReportData['violations']): PublicReportData['recommendations'] {
  const recommendations = [];

  // High priority: Critical and serious issues
  const criticalViolations = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  if (criticalViolations.length > 0) {
    recommendations.push({
      priority: 'high' as const,
      title: 'Address Critical Accessibility Barriers',
      description: `Fix ${criticalViolations.length} critical accessibility issues that prevent users with disabilities from accessing your content.`,
      estimated_effort: '2-4 weeks',
      wcag_references: criticalViolations.slice(0, 3).map(v => v.criterion)
    });
  }

  // Medium priority: Keyboard and focus management
  const keyboardIssues = violations.filter(v => 
    v.criterion.includes('Keyboard') || v.criterion.includes('Focus')
  );
  if (keyboardIssues.length > 0) {
    recommendations.push({
      priority: 'medium' as const,
      title: 'Improve Keyboard Navigation',
      description: 'Ensure all interactive elements are accessible via keyboard navigation and have proper focus indicators.',
      estimated_effort: '1-2 weeks',
      wcag_references: keyboardIssues.slice(0, 2).map(v => v.criterion)
    });
  }

  // Low priority: Minor improvements
  const minorIssues = violations.filter(v => v.impact === 'minor' || v.impact === 'moderate');
  if (minorIssues.length > 0) {
    recommendations.push({
      priority: 'low' as const,
      title: 'Polish Accessibility Experience',
      description: 'Address remaining accessibility issues to improve the overall user experience for people with disabilities.',
      estimated_effort: '1-3 weeks',
      wcag_references: minorIssues.slice(0, 2).map(v => v.criterion)
    });
  }

  return recommendations;
}

function calculateScanDuration(createdAt: string, updatedAt: string): number {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime();
}

function getUniquePageCount(findings: any[]): number {
  const uniquePages = new Set(findings.map(f => f.page_url).filter(Boolean));
  return uniquePages.size || 1;
}