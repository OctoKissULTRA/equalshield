export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { 
  newRawToken, 
  hashToken, 
  calculateExpiration, 
  validateShareParams, 
  generateShareUrl,
  generateTokenDescription 
} from '@/lib/share';
import { entitlementsService } from '@/lib/entitlements';

/**
 * POST /api/reports/share
 * 
 * Create a shareable link for a scan report
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();
    const { scanId, ttlDays = 7, maxViews = 50 } = await req.json();

    // Validate required fields
    if (!scanId) {
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }

    // TODO: Get org and user from session
    // For now, we'll use a placeholder approach
    const orgId = '1'; // This should come from authenticated session
    const userId = '1'; // This should come from authenticated session

    // Verify scan exists and belongs to organization
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .select('id, org_id, status')
      .eq('id', scanId)
      .eq('org_id', orgId)
      .single();

    if (scanError || !scan) {
      return NextResponse.json(
        { error: 'Scan not found or access denied' },
        { status: 404 }
      );
    }

    // Only allow sharing of completed scans
    if (scan.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only share completed scans' },
        { status: 400 }
      );
    }

    // Validate and sanitize sharing parameters
    const params = validateShareParams({ ttlDays, maxViews });

    // Generate secure token
    const rawToken = newRawToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = calculateExpiration(params.ttlDays);

    // Insert share token record
    const { data: shareToken, error: insertError } = await supabase
      .from('share_tokens')
      .insert({
        org_id: orgId,
        scan_id: scanId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        max_views: params.maxViews,
        created_by: userId
      })
      .select('id, expires_at, max_views')
      .single();

    if (insertError) {
      console.error('Failed to create share token:', insertError);
      return NextResponse.json(
        { error: 'Failed to create shareable link' },
        { status: 500 }
      );
    }

    // Log the sharing event
    try {
      await entitlementsService.logBillingEvent(
        orgId,
        'report.shared',
        {
          scan_id: scanId,
          token_id: shareToken.id,
          expires_at: expiresAt.toISOString(),
          max_views: params.maxViews,
          ttl_days: params.ttlDays
        }
      );
    } catch (logError) {
      console.error('Failed to log sharing event:', logError);
      // Don't fail the request for logging errors
    }

    // Return the shareable URL (this is the only time the raw token leaves the server)
    const shareUrl = generateShareUrl(rawToken);
    const description = generateTokenDescription(params.ttlDays, params.maxViews);

    return NextResponse.json({
      success: true,
      url: shareUrl,
      fullUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${shareUrl}`,
      tokenId: shareToken.id,
      expiresAt: shareToken.expires_at,
      maxViews: shareToken.max_views,
      description
    });

  } catch (error) {
    console.error('Share creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create shareable link' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports/share?orgId=<id>
 * 
 * List all share tokens for an organization
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();

    // Get all non-expired share tokens for the organization
    const { data: shareTokens, error } = await supabase
      .from('share_tokens')
      .select(`
        id,
        scan_id,
        expires_at,
        revoked_at,
        max_views,
        views,
        created_at,
        scans!inner(url, status, created_at)
      `)
      .eq('org_id', orgId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch share tokens:', error);
      return NextResponse.json(
        { error: 'Failed to fetch shareable links' },
        { status: 500 }
      );
    }

    // Format the response
    const formattedTokens = shareTokens.map(token => ({
      id: token.id,
      scanId: token.scan_id,
      scanUrl: token.scans.url,
      scanDate: token.scans.created_at,
      expiresAt: token.expires_at,
      revokedAt: token.revoked_at,
      maxViews: token.max_views,
      views: token.views,
      createdAt: token.created_at,
      isActive: !token.revoked_at && new Date(token.expires_at) > new Date(),
      viewsRemaining: Math.max(0, token.max_views - token.views)
    }));

    return NextResponse.json({
      success: true,
      tokens: formattedTokens
    });

  } catch (error) {
    console.error('Share tokens fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shareable links' },
      { status: 500 }
    );
  }
}