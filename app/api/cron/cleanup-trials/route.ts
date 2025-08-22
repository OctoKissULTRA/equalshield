export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/cron/cleanup-trials
 * 
 * Cleanup expired trial organizations and sessions
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

    // Use the cleanup function defined in the migration
    const { data: deletedCount, error } = await supabase.rpc('cleanup_expired_trials');

    if (error) {
      console.error('Failed to cleanup trials:', error);
      return NextResponse.json(
        { error: 'Cleanup failed', details: error.message },
        { status: 500 }
      );
    }

    // Also clean up old trial scan jobs that might be stuck
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const { error: jobCleanupError } = await supabase
      .from('scan_jobs')
      .delete()
      .lt('created_at', oneDayAgo.toISOString())
      .in('status', ['pending', 'processing'])
      .neq('max_duration_ms', null); // Only clean up jobs with duration limits (trials)

    if (jobCleanupError) {
      console.warn('Failed to cleanup trial scan jobs:', jobCleanupError);
    }

    console.log(`Trial cleanup completed: ${deletedCount || 0} trials cleaned up`);

    return NextResponse.json({
      success: true,
      deletedTrials: deletedCount || 0,
      timestamp: new Date().toISOString(),
      message: `Cleaned up ${deletedCount || 0} expired trials`
    });

  } catch (error) {
    console.error('Trial cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/cleanup-trials
 * 
 * Manual trial cleanup with additional analytics
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
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get analytics before cleanup
    const { data: trialStats, error: statsError } = await supabase
      .from('trial_orgs')
      .select('id, domain, completed_scans, upgraded_at, created_at, expires_at')
      .lt('expires_at', now.toISOString());

    let stats = {
      total_expired: 0,
      completed_trials: 0,
      upgraded_trials: 0,
      never_used: 0,
      domains: new Set<string>()
    };

    if (!statsError && trialStats) {
      stats = trialStats.reduce((acc, trial) => {
        acc.total_expired++;
        if (trial.completed_scans > 0) acc.completed_trials++;
        if (trial.upgraded_at) acc.upgraded_trials++;
        if (trial.completed_scans === 0) acc.never_used++;
        acc.domains.add(trial.domain);
        return acc;
      }, stats);
    }

    // Perform cleanup
    const { data: deletedCount, error: cleanupError } = await supabase.rpc('cleanup_expired_trials');

    if (cleanupError) {
      throw cleanupError;
    }

    // Additional cleanup: Remove very old trial scan data
    const { error: scanCleanupError } = await supabase
      .from('scans')
      .update({ trial_org_id: null })
      .eq('is_trial', true)
      .lt('created_at', thirtyDaysAgo.toISOString())
      .not('trial_org_id', 'is', null);

    console.log(`Comprehensive trial cleanup completed:`, {
      deleted_trials: deletedCount || 0,
      expired_with_usage: stats.completed_trials,
      converted_trials: stats.upgraded_trials,
      never_used: stats.never_used,
      unique_domains: stats.domains.size
    });

    return NextResponse.json({
      success: true,
      cleanup: {
        deletedTrials: deletedCount || 0,
        expiredWithUsage: stats.completed_trials,
        convertedTrials: stats.upgraded_trials,
        neverUsed: stats.never_used,
        uniqueDomains: stats.domains.size
      },
      timestamp: now.toISOString(),
      message: `Comprehensive trial cleanup completed`
    });

  } catch (error) {
    console.error('Comprehensive trial cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}