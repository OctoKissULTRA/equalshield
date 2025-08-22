export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/cron/cleanup-tokens
 * 
 * Cleanup expired and old share tokens
 * This should be called by a cron job (e.g., Vercel Cron)
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = req.headers.get('authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseClient();
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Delete tokens that are expired for more than 7 days or were revoked more than 7 days ago
    const { data: deletedTokens, error: deleteError } = await supabase
      .from('share_tokens')
      .delete()
      .or(
        `and(expires_at.lt.${oneWeekAgo.toISOString()},revoked_at.is.null),revoked_at.lt.${oneWeekAgo.toISOString()}`
      )
      .select('id');

    if (deleteError) {
      console.error('Failed to cleanup tokens:', deleteError);
      return NextResponse.json(
        { error: 'Cleanup failed', details: deleteError.message },
        { status: 500 }
      );
    }

    const deletedCount = deletedTokens?.length || 0;

    // Log cleanup activity
    console.log(`Token cleanup completed: ${deletedCount} tokens deleted`);

    return NextResponse.json({
      success: true,
      deletedCount,
      timestamp: now.toISOString(),
      message: `Cleaned up ${deletedCount} expired share tokens`
    });

  } catch (error) {
    console.error('Token cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Alternative cleanup using raw SQL (if Supabase query gets complex)
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = req.headers.get('authorization');
    if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseClient();

    // Use the cleanup function defined in the migration
    const { data, error } = await supabase.rpc('cleanup_expired_share_tokens');

    if (error) {
      console.error('Failed to cleanup tokens via function:', error);
      return NextResponse.json(
        { error: 'Cleanup failed', details: error.message },
        { status: 500 }
      );
    }

    const deletedCount = data || 0;

    console.log(`Token cleanup via function completed: ${deletedCount} tokens deleted`);

    return NextResponse.json({
      success: true,
      deletedCount,
      timestamp: new Date().toISOString(),
      message: `Cleaned up ${deletedCount} expired share tokens using SQL function`
    });

  } catch (error) {
    console.error('Token cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}