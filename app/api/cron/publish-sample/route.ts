export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireCron } from '@/lib/security/cron-auth';
import { createSupabaseClient } from '@/lib/supabase/server';
import { createShareLinkForScan, storeSampleShareUrl } from '@/lib/share/publish';

/**
 * GET /api/cron/publish-sample
 * 
 * Publishes a fresh sample report share link from the latest self-scan
 * This should run after the self-scan cron to ensure fresh sample data
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

    // Get domain from environment
    const selfScanUrl = process.env.SELF_SCAN_URL;
    if (!selfScanUrl) {
      return NextResponse.json(
        { error: 'SELF_SCAN_URL not configured' },
        { status: 500 }
      );
    }

    const domain = new URL(selfScanUrl).hostname;
    const supabase = createSupabaseClient();

    // Find the latest completed scan for our domain
    const { data: latestScan, error: scanError } = await supabase
      .from('scans')
      .select('id, finished_at, score, pour_scores, url, status')
      .eq('domain', domain)
      .eq('status', 'completed')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .single();

    if (scanError) {
      console.error('Failed to find latest scan:', scanError);
      return NextResponse.json(
        { error: 'Failed to find latest scan', details: scanError.message },
        { status: 500 }
      );
    }

    if (!latestScan) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'no_scan',
          message: 'No completed scans found for domain',
          domain 
        },
        { status: 404 }
      );
    }

    // Create a new share link for this scan
    // Use generous limits for the public sample
    const shareLink = await createShareLinkForScan({
      scanId: latestScan.id,
      ttlDays: 14, // 2 weeks
      maxViews: 500, // High view limit for public sample
      watermark: false // No watermark for company's own site
    });

    // Store the share URL in cache for the trust page
    storeSampleShareUrl(shareLink.url, latestScan.id);

    // Log the successful publication
    console.log(`Sample report published: ${shareLink.url} for scan ${latestScan.id}`);

    // Track analytics event
    if (typeof window === 'undefined') {
      // Server-side analytics tracking
      const { analytics } = await import('@/lib/analytics/events');
      analytics.emit({
        type: 'trust.sample.published',
        scan_id: latestScan.id,
        share_url: shareLink.url,
        domain,
        scan_score: latestScan.score,
        scan_finished_at: latestScan.finished_at,
        expires_at: shareLink.expiresAt.toISOString(),
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({
      success: true,
      scanId: latestScan.id,
      shareUrl: shareLink.url,
      fullUrl: `${req.nextUrl.origin}${shareLink.url}`,
      finishedAt: latestScan.finished_at,
      expiresAt: shareLink.expiresAt.toISOString(),
      domain,
      scanData: {
        score: latestScan.score,
        pourScores: latestScan.pour_scores,
        url: latestScan.url
      },
      message: 'Sample report published successfully'
    });

  } catch (error) {
    console.error('Sample publish cron error:', error);
    
    // Return appropriate error response
    if (error instanceof Error && error.message.includes('cron')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to publish sample report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/publish-sample
 * 
 * Manual trigger for sample publishing (for testing)
 */
export async function POST(req: NextRequest) {
  // Same logic as GET but could include additional manual options
  return GET(req);
}

/**
 * DELETE /api/cron/publish-sample
 * 
 * Revoke current sample share link (for emergency situations)
 */
export async function DELETE(req: NextRequest) {
  try {
    const cronSecret = process.env.TRUST_CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { error: 'TRUST_CRON_SECRET not configured' },
        { status: 500 }
      );
    }

    requireCron(req, cronSecret);

    const domain = process.env.SELF_SCAN_URL ? new URL(process.env.SELF_SCAN_URL).hostname : 'equalshield.com';
    const supabase = createSupabaseClient();

    // Revoke all active share tokens for our domain's scans
    const { error: revokeError } = await supabase.rpc('revoke_sample_share_tokens', {
      p_domain: domain
    });

    if (revokeError) {
      console.error('Failed to revoke sample tokens:', revokeError);
      return NextResponse.json(
        { error: 'Failed to revoke sample tokens' },
        { status: 500 }
      );
    }

    // Clear cache
    storeSampleShareUrl('', '');

    return NextResponse.json({
      success: true,
      message: 'Sample share tokens revoked',
      domain
    });

  } catch (error) {
    console.error('Sample revoke error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke sample' },
      { status: 500 }
    );
  }
}