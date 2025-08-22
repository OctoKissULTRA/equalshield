export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireCron } from '@/lib/security/cron-auth';
import { scheduleScan, SCAN_LIMITS } from '@/lib/scan/scheduler';

/**
 * GET /api/cron/self-scan
 * 
 * Weekly self-scan cron job for trust page
 * Scans the company's own website to demonstrate confidence
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron authentication
    const cronSecret = process.env.TRUST_CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'TRUST_CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    requireCron(req, cronSecret);

    // Get configuration from environment
    const selfScanUrl = process.env.SELF_SCAN_URL;
    const selfScanOrgId = process.env.SELF_SCAN_ORG_ID;

    if (!selfScanUrl || !selfScanOrgId) {
      return NextResponse.json(
        { 
          error: 'Missing required environment variables',
          missing: [
            !selfScanUrl && 'SELF_SCAN_URL',
            !selfScanOrgId && 'SELF_SCAN_ORG_ID'
          ].filter(Boolean)
        },
        { status: 500 }
      );
    }

    // Validate URL format
    try {
      new URL(selfScanUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid SELF_SCAN_URL format' },
        { status: 400 }
      );
    }

    // Schedule the self-scan with premium settings
    const scanId = await scheduleScan({
      orgId: selfScanOrgId,
      url: selfScanUrl,
      email: 'trust@equalshield.com',
      depth: 'standard',
      maxPages: SCAN_LIMITS.self_scan.maxPages,
      maxDurationMs: SCAN_LIMITS.self_scan.maxDurationMs,
      priority: SCAN_LIMITS.self_scan.priority
    });

    // Log the event for monitoring
    console.log(`Self-scan scheduled: ${scanId} for ${selfScanUrl}`);

    // Track analytics event
    if (typeof window === 'undefined') {
      // Server-side analytics tracking
      const { analytics } = await import('@/lib/analytics/events');
      analytics.emit({
        type: 'trust.selfscan.scheduled',
        scan_id: scanId,
        url: selfScanUrl,
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      scanId,
      url: selfScanUrl,
      message: 'Self-scan scheduled successfully',
      statusUrl: `/api/progress/${scanId}`,
      limits: {
        maxPages: SCAN_LIMITS.self_scan.maxPages,
        maxDurationMs: SCAN_LIMITS.self_scan.maxDurationMs
      },
      scheduledAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Self-scan cron error:', error);
    
    // Return appropriate error response
    if (error instanceof Error && error.message.includes('cron')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to schedule self-scan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/self-scan
 * 
 * Manual trigger for self-scan (for testing)
 */
export async function POST(req: NextRequest) {
  // Same logic as GET but with different authentication
  // Could be used for manual testing or emergency scans
  return GET(req);
}