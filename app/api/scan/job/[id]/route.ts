export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const jobId = resolvedParams.id;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseClient();
    
    // Get job status
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .select('status, last_error, created_at, claimed_at, completed_at, scan_id, depth')
      .eq('id', jobId)
      .single();

    if (error || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    // Calculate progress estimate
    let progress = 0;
    let message = 'Scan queued';
    
    switch (job.status) {
      case 'queued':
        progress = 10;
        message = 'Waiting in queue...';
        break;
      case 'claimed':
        progress = 25;
        message = 'Starting scan process...';
        break;
      case 'processing':
        progress = 50;
        message = 'Analyzing accessibility...';
        break;
      case 'done':
        progress = 100;
        message = 'Scan completed successfully';
        break;
      case 'failed':
        progress = 0;
        message = 'Scan failed';
        break;
    }

    // Calculate elapsed time
    const createdAt = new Date(job.created_at);
    const elapsedMs = Date.now() - createdAt.getTime();
    const elapsedSeconds = Math.floor(elapsedMs / 1000);

    const response = {
      jobId,
      status: job.status,
      progress,
      message,
      elapsedSeconds,
      depth: job.depth,
      scanId: job.scan_id,
      completedAt: job.completed_at,
      error: job.last_error
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Job status error:', error);
    return NextResponse.json(
      { error: 'Failed to get job status' },
      { status: 500 }
    );
  }
}