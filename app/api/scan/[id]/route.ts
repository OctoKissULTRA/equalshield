import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scans, violations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const scanId = parseInt(resolvedParams.id);
    
    if (isNaN(scanId)) {
      return NextResponse.json(
        { error: 'Invalid scan ID' },
        { status: 400 }
      );
    }

    // Get scan data
    const [scan] = await db
      .select()
      .from(scans)
      .where(eq(scans.id, scanId))
      .limit(1);

    if (!scan) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    // Get violations if scan is complete
    let scanViolations: any[] = [];
    if (scan.status === 'complete') {
      scanViolations = await db
        .select()
        .from(violations)
        .where(eq(violations.scanId, scanId));
    }

    // Calculate summary stats
    const summary = {
      total: scanViolations.length,
      critical: scanViolations.filter(v => v.severity === 'critical').length,
      serious: scanViolations.filter(v => v.severity === 'serious').length,
      moderate: scanViolations.filter(v => v.severity === 'moderate').length,
      minor: scanViolations.filter(v => v.severity === 'minor').length,
    };

    // Group violations by WCAG criterion
    const violationsByWCAG = scanViolations.reduce((acc, v) => {
      const criterion = v.wcagCriterion;
      if (!acc[criterion]) {
        acc[criterion] = [];
      }
      acc[criterion].push(v);
      return acc;
    }, {} as Record<string, any[]>);

    return NextResponse.json({
      scan: {
        id: scan.id,
        url: scan.url,
        domain: scan.domain,
        status: scan.status,
        wcagScore: scan.wcagScore,
        adaRiskScore: scan.adaRiskScore,
        lawsuitProbability: scan.lawsuitProbability,
        totalViolations: scan.totalViolations,
        criticalViolations: scan.criticalViolations,
        seriousViolations: scan.seriousViolations,
        moderateViolations: scan.moderateViolations,
        minorViolations: scan.minorViolations,
        processingTimeMs: scan.processingTimeMs,
        createdAt: scan.createdAt,
        completedAt: scan.completedAt,
        errorMessage: scan.errorMessage,
        // Include canonical page data if available
        canonicalPage: scan.violations ? (scan.violations as any).canonicalPage : null,
        aiAnalysis: scan.aiAnalysis
      },
      violations: scanViolations,
      summary,
      violationsByWCAG,
      // Status indicators for UI
      isProcessing: scan.status === 'processing',
      isPending: scan.status === 'pending',
      isComplete: scan.status === 'complete',
      hasFailed: scan.status === 'failed',
      // Progress estimation
      progress: scan.status === 'complete' ? 100 :
                scan.status === 'processing' ? 50 :
                scan.status === 'pending' ? 10 : 0
    });

  } catch (error) {
    console.error('Scan retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve scan data' },
      { status: 500 }
    );
  }
}