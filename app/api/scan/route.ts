export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { scanRateLimiter, withRateLimit } from '@/lib/utils/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitHeaders = withRateLimit(scanRateLimiter)(req);
    
    const { url, email, depth = 'standard', tier = 'free' } = await req.json();
    
    // Validate inputs
    if (!url || !email) {
      return NextResponse.json(
        { error: 'URL and email are required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Validate depth parameter
    if (!['quick', 'standard', 'deep'].includes(depth)) {
      return NextResponse.json(
        { error: 'Invalid depth. Must be quick, standard, or deep' },
        { status: 400 }
      );
    }

    // Get or create organization
    const domain = new URL(url).hostname;
    
    let orgResult = await db().select().from(teams).where(eq(teams.stripeCustomerId, email)).limit(1);
    let orgId: string;
    
    if (orgResult.length === 0) {
      const newOrg = await db().insert(teams).values({
        name: domain,
        planName: tier,
        stripeCustomerId: email // Using for email temporarily
      }).returning({ id: teams.id });
      
      orgId = newOrg[0].id.toString();
    } else {
      orgId = orgResult[0].id.toString();
    }

    // Enqueue job using Supabase job queue
    const supabase = createSupabaseClient();
    const { data: job, error } = await supabase
      .from('scan_jobs')
      .insert({
        org_id: orgId,
        url,
        depth,
        priority: tier === 'free' ? 10 : tier === 'professional' ? 5 : 1
      })
      .select('id')
      .single();

    if (error) {
      console.error('Job queue error:', error);
      return NextResponse.json(
        { error: 'Failed to queue scan job' },
        { status: 500, headers: rateLimitHeaders }
      );
    }

    // Return job ID for status polling
    const estimatedTime = depth === 'quick' ? '30 seconds' : depth === 'standard' ? '2 minutes' : '5 minutes';
    
    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Scan queued successfully. Processing will begin shortly.',
      statusUrl: `/api/scan/job/${job.id}`,
      estimatedTime
    }, {
      headers: rateLimitHeaders
    });

  } catch (error) {
    console.error('Scan API error:', error);
    
    // Handle rate limit errors
    if (error instanceof Error && error.message.includes('Rate limit exceeded')) {
      return NextResponse.json(
        { error: error.message },
        { status: 429 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to queue scan. Please try again.' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    mode: 'queue-only',
    workerUrl: process.env.SCAN_WORKER_URL || 'polling-based'
  });
}