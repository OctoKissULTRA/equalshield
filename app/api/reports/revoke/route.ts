export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { entitlementsService } from '@/lib/entitlements';

/**
 * POST /api/reports/revoke
 * 
 * Revoke a shareable link by setting revoked_at timestamp
 */
export async function POST(req: NextRequest) {
  try {
    const { tokenId } = await req.json();

    if (!tokenId) {
      return NextResponse.json(
        { error: 'Token ID is required' },
        { status: 400 }
      );
    }

    // TODO: Get org from authenticated session
    const orgId = '1'; // This should come from authenticated session

    const supabase = createSupabaseClient();

    // First, verify the token belongs to the organization
    const { data: existingToken, error: fetchError } = await supabase
      .from('share_tokens')
      .select('id, org_id, scan_id, revoked_at')
      .eq('id', tokenId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !existingToken) {
      return NextResponse.json(
        { error: 'Share token not found or access denied' },
        { status: 404 }
      );
    }

    // Check if already revoked
    if (existingToken.revoked_at) {
      return NextResponse.json(
        { error: 'Share token is already revoked' },
        { status: 400 }
      );
    }

    // Revoke the token
    const { error: revokeError } = await supabase
      .from('share_tokens')
      .update({ 
        revoked_at: new Date().toISOString() 
      })
      .eq('id', tokenId)
      .eq('org_id', orgId);

    if (revokeError) {
      console.error('Failed to revoke share token:', revokeError);
      return NextResponse.json(
        { error: 'Failed to revoke shareable link' },
        { status: 500 }
      );
    }

    // Log the revocation event
    try {
      await entitlementsService.logBillingEvent(
        orgId,
        'report.revoked',
        {
          token_id: tokenId,
          scan_id: existingToken.scan_id,
          revoked_at: new Date().toISOString()
        }
      );
    } catch (logError) {
      console.error('Failed to log revocation event:', logError);
      // Don't fail the request for logging errors
    }

    return NextResponse.json({
      success: true,
      message: 'Shareable link revoked successfully',
      tokenId,
      revokedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token revocation error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke shareable link' },
      { status: 500 }
    );
  }
}