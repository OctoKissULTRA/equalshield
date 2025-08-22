export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimitCheck, getClientIdentifier, rateLimitedResponse } from '@/lib/security/rate-limit';
import { validateScanUrl } from '@/lib/security/url-guard';

export async function POST(req: NextRequest) {
  try {
    // Apply rate limiting
    const clientId = await getClientIdentifier(req);
    const { success, remaining, reset, headers } = await rateLimitCheck(clientId, 'free');
    
    if (!success) {
      return rateLimitedResponse(remaining, reset);
    }
    
    const { url, email, depth = 'standard', tier = 'free' } = await req.json();
    
    // Validate inputs
    if (!url || !email) {
      return NextResponse.json(
        { error: 'URL and email are required' },
        { status: 400, headers }
      );
    }

    // SSRF protection - validate URL is public and safe
    const urlValidation = await validateScanUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error },
        { status: 400, headers }
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

    // Create scan record first, then enqueue job
    const supabase = createSupabaseClient();
    
    // Create scan with UUID primary key
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        url,
        org_id: orgId,
        email,
        depth,
        status: 'pending'
      })
      .select('id')
      .single();

    if (scanError) {
      console.error('Scan creation error:', scanError);
      return NextResponse.json(
        { error: 'Failed to create scan record' },
        { status: 500, headers }
      );
    }

    // Enqueue job with scan_id reference
    const { data: job, error: jobError } = await supabase
      .from('scan_jobs')
      .insert({
        scan_id: scan.id,
        org_id: orgId,
        url,
        depth,
        priority: tier === 'free' ? 10 : tier === 'professional' ? 5 : 1
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Job queue error:', jobError);
      return NextResponse.json(
        { error: 'Failed to queue scan job' },
        { status: 500, headers }
      );
    }

    // Return scanId (UUID) for status polling
    const estimatedTime = depth === 'quick' ? '30 seconds' : depth === 'standard' ? '2 minutes' : '5 minutes';
    
    return NextResponse.json({
      success: true,
      scanId: scan.id, // Return UUID scanId instead of jobId
      message: 'Scan queued successfully. Processing will begin shortly.',
      statusUrl: `/api/scan/${scan.id}`,
      estimatedTime
    }, {
      headers
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