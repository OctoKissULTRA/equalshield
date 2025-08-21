export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseClient();

    // Get worker heartbeats
    const { data: workers, error: workersError } = await supabase
      .from('worker_heartbeats')
      .select('*')
      .order('last_heartbeat', { ascending: false });

    if (workersError) {
      throw workersError;
    }

    // Get job queue stats
    const { data: queueStats, error: queueError } = await supabase
      .from('scan_jobs')
      .select('status')
      .then(({ data, error }) => {
        if (error) throw error;
        
        const stats = {
          queued: 0,
          claimed: 0,
          processing: 0,
          done: 0,
          failed: 0,
          total: data?.length || 0
        };

        data?.forEach(job => {
          stats[job.status as keyof typeof stats]++;
        });

        return { data: stats, error: null };
      });

    if (queueError) {
      throw queueError;
    }

    // Mark stale workers as inactive
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes
    const activeWorkers = workers?.filter(w => new Date(w.last_heartbeat) > staleThreshold) || [];
    const staleWorkers = workers?.filter(w => new Date(w.last_heartbeat) <= staleThreshold) || [];

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      workers: {
        active: activeWorkers.length,
        stale: staleWorkers.length,
        total: workers?.length || 0,
        details: workers?.map(w => ({
          ...w,
          isActive: new Date(w.last_heartbeat) > staleThreshold,
          lastHeartbeatAgo: Math.floor((Date.now() - new Date(w.last_heartbeat).getTime()) / 1000)
        }))
      },
      queue: queueStats,
      health: {
        overallStatus: activeWorkers.length > 0 ? 'healthy' : 'warning',
        queueBacklog: queueStats.queued + queueStats.claimed + queueStats.processing,
        throughput: activeWorkers.reduce((sum, w) => sum + (w.jobs_processed || 0), 0)
      }
    });

  } catch (error) {
    console.error('Worker status error:', error);
    return NextResponse.json(
      { error: 'Failed to get worker status' },
      { status: 500 }
    );
  }
}