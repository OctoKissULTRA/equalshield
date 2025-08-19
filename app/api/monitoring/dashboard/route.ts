import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { scans, violations, teams } from '@/lib/db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email');
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    // Get user's organization
    const [org] = await db
      .select()
      .from(teams)
      .where(eq(teams.stripeCustomerId, email))
      .limit(1);

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get last 30 days of scans
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentScans = await db
      .select()
      .from(scans)
      .where(
        and(
          eq(scans.teamId, org.id),
          gte(scans.createdAt, thirtyDaysAgo)
        )
      )
      .orderBy(desc(scans.createdAt));

    // Calculate trending metrics
    const completedScans = recentScans.filter(s => s.status === 'complete');
    
    const avgWcagScore = completedScans.length > 0 
      ? Math.round(completedScans.reduce((sum, s) => sum + (s.wcagScore || 0), 0) / completedScans.length)
      : 0;
      
    const avgAdaRisk = completedScans.length > 0
      ? Math.round(completedScans.reduce((sum, s) => sum + (s.adaRiskScore || 0), 0) / completedScans.length)
      : 0;

    const totalViolations = completedScans.reduce((sum, s) => sum + (s.totalViolations || 0), 0);
    const criticalViolations = completedScans.reduce((sum, s) => sum + (s.criticalViolations || 0), 0);

    // Get top violation types
    const violationStats = await db
      .select({
        wcagCriterion: violations.wcagCriterion,
        severity: violations.severity,
        count: sql<number>`count(*)`.as('count')
      })
      .from(violations)
      .innerJoin(scans, eq(violations.scanId, scans.id))
      .where(
        and(
          eq(scans.teamId, org.id),
          gte(scans.createdAt, thirtyDaysAgo)
        )
      )
      .groupBy(violations.wcagCriterion, violations.severity)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    // Get domain performance
    const domainStats = completedScans.reduce((acc, scan) => {
      const domain = scan.domain;
      if (!acc[domain]) {
        acc[domain] = {
          domain,
          scans: 0,
          avgWcagScore: 0,
          avgAdaRisk: 0,
          totalViolations: 0,
          lastScan: scan.createdAt
        };
      }
      
      acc[domain].scans++;
      acc[domain].avgWcagScore += scan.wcagScore || 0;
      acc[domain].avgAdaRisk += scan.adaRiskScore || 0;
      acc[domain].totalViolations += scan.totalViolations || 0;
      
      if (new Date(scan.createdAt) > new Date(acc[domain].lastScan)) {
        acc[domain].lastScan = scan.createdAt;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate averages for domains
    Object.values(domainStats).forEach((domain: any) => {
      domain.avgWcagScore = Math.round(domain.avgWcagScore / domain.scans);
      domain.avgAdaRisk = Math.round(domain.avgAdaRisk / domain.scans);
    });

    // Get scan timeline for chart
    const scanTimeline = completedScans
      .slice(0, 20)
      .reverse()
      .map(scan => ({
        date: scan.createdAt,
        wcagScore: scan.wcagScore || 0,
        adaRisk: scan.adaRiskScore || 0,
        violations: scan.totalViolations || 0,
        domain: scan.domain
      }));

    // Identify trends
    const recentScores = completedScans.slice(0, 5).map(s => s.wcagScore || 0);
    const olderScores = completedScans.slice(5, 10).map(s => s.wcagScore || 0);
    
    const recentAvg = recentScores.length > 0 ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length : 0;
    const olderAvg = olderScores.length > 0 ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length : 0;
    
    const wcagTrend = recentAvg > olderAvg ? 'improving' : recentAvg < olderAvg ? 'declining' : 'stable';

    // Get competitor comparison (mock data for now)
    const competitorData = {
      yourAvgScore: avgWcagScore,
      industryAvg: 75,
      topCompetitor: 82,
      bottomCompetitor: 68
    };

    return NextResponse.json({
      overview: {
        totalScans: recentScans.length,
        completedScans: completedScans.length,
        avgWcagScore,
        avgAdaRisk,
        totalViolations,
        criticalViolations,
        wcagTrend
      },
      violationStats,
      domainStats: Object.values(domainStats),
      scanTimeline,
      competitorData,
      alerts: [
        ...(criticalViolations > 10 ? [{
          type: 'critical',
          message: `${criticalViolations} critical violations found across your sites`,
          action: 'Review and fix immediately'
        }] : []),
        ...(avgAdaRisk > 70 ? [{
          type: 'warning',
          message: 'High ADA risk detected across multiple domains',
          action: 'Consider professional audit'
        }] : []),
        ...(wcagTrend === 'declining' ? [{
          type: 'info',
          message: 'WCAG scores trending downward',
          action: 'Review recent changes'
        }] : [])
      ]
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate dashboard data' },
      { status: 500 }
    );
  }
}