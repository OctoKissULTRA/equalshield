export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { progressTracker } from '@/lib/realtime/progress';
import { getUsageStats } from '@/lib/usage';
import { createSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/metrics/live
 * 
 * Returns live system metrics and usage statistics
 * Supports Server-Sent Events for real-time dashboard updates
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format');
  const orgId = searchParams.get('orgId');

  // Handle Server-Sent Events for real-time metrics
  if (format === 'sse') {
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      start(controller) {
        // Subscribe to metrics updates
        const unsubscribe = progressTracker.subscribeMetrics((metrics) => {
          const data = `data: ${JSON.stringify(metrics)}\n\n`;
          controller.enqueue(encoder.encode(data));
        });

        // Send keepalive pings every 30 seconds
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode('data: {"type":"ping"}\n\n'));
        }, 30000);

        // Handle client disconnect
        req.signal.addEventListener('abort', () => {
          unsubscribe();
          clearInterval(keepAlive);
          controller.close();
        });

        // Timeout after 1 hour
        setTimeout(() => {
          unsubscribe();
          clearInterval(keepAlive);
          controller.close();
        }, 60 * 60 * 1000);
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    });
  }

  // Handle regular JSON request
  try {
    // Get system-wide metrics
    const systemMetrics = await generateSystemMetrics();
    
    // Get organization-specific metrics if orgId provided
    let orgMetrics = null;
    if (orgId) {
      orgMetrics = await getUsageStats(orgId);
    }

    // Get active scans
    const activeScans = progressTracker.getActiveScans();

    return NextResponse.json({
      system: systemMetrics,
      organization: orgMetrics,
      activeScans: activeScans.map(scan => ({
        scanId: scan.scanId,
        status: scan.status,
        progress: scan.progress,
        currentStep: scan.currentStep,
        pagesCrawled: scan.pagesCrawled,
        pagesDiscovered: scan.pagesDiscovered
      })),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Failed to fetch live metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

async function generateSystemMetrics() {
  try {
    const supabase = createSupabaseClient();
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get scan statistics
    const { data: scansToday, error: scansError } = await supabase
      .from('scans')
      .select('id, status, created_at, updated_at')
      .gte('created_at', oneDayAgo.toISOString());

    if (scansError) throw scansError;

    const { data: scansThisHour } = await supabase
      .from('scans')
      .select('id')
      .gte('created_at', oneHourAgo.toISOString());

    // Calculate metrics
    const totalScansToday = scansToday?.length || 0;
    const completedScansToday = scansToday?.filter(s => s.status === 'completed').length || 0;
    const failedScansToday = scansToday?.filter(s => s.status === 'failed').length || 0;
    const scansThisHourCount = scansThisHour?.length || 0;

    // Calculate average scan time
    const completedScans = scansToday?.filter(s => 
      s.status === 'completed' && s.updated_at
    ) || [];
    
    const avgScanTime = completedScans.length > 0 
      ? completedScans.reduce((sum, scan) => {
          const duration = new Date(scan.updated_at).getTime() - new Date(scan.created_at).getTime();
          return sum + duration;
        }, 0) / completedScans.length
      : 0;

    // Get hourly trends for the last 24 hours
    const trendsData = await generateHourlyTrends(supabase, now);

    return {
      scans: {
        total_today: totalScansToday,
        completed_today: completedScansToday,
        failed_today: failedScansToday,
        this_hour: scansThisHourCount,
        success_rate: totalScansToday > 0 ? Math.round((completedScansToday / totalScansToday) * 100) : 100,
        avg_duration_ms: Math.round(avgScanTime)
      },
      system: {
        status: failedScansToday > completedScansToday * 0.1 ? 'degraded' : 'healthy',
        active_scans: progressTracker.getActiveScans().length,
        queue_depth: progressTracker.getActiveScans().filter(s => s.status === 'queued').length
      },
      trends: trendsData,
      updated_at: now.toISOString()
    };

  } catch (error) {
    console.error('Failed to generate system metrics:', error);
    return {
      scans: { total_today: 0, completed_today: 0, failed_today: 0, this_hour: 0, success_rate: 100, avg_duration_ms: 0 },
      system: { status: 'unknown', active_scans: 0, queue_depth: 0 },
      trends: [],
      updated_at: new Date().toISOString()
    };
  }
}

async function generateHourlyTrends(supabase: any, now: Date) {
  const trends = [];
  
  for (let i = 23; i >= 0; i--) {
    const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    
    const { data: hourlyScans } = await supabase
      .from('scans')
      .select('id, status')
      .gte('created_at', hourStart.toISOString())
      .lt('created_at', hourEnd.toISOString());

    trends.push({
      hour: hourStart.toISOString(),
      scans: hourlyScans?.length || 0,
      completed: hourlyScans?.filter(s => s.status === 'completed').length || 0,
      failed: hourlyScans?.filter(s => s.status === 'failed').length || 0
    });
  }
  
  return trends;
}