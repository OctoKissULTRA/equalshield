export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { rateLimitCheck, getClientIdentifier, rateLimitedResponse } from '@/lib/security/rate-limit';
import { validateScanUrl } from '@/lib/security/url-guard';
import { checkScanLimits, incrementUsage } from '@/lib/entitlements';
import { trackScanStarted, trackBlockedUrl } from '@/lib/analytics/events';

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
      // Track blocked URL for analytics
      trackBlockedUrl(url, urlValidation.error || 'SSRF protection', clientId);
      
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
      
      // TODO: Create default entitlements for new org
      // await entitlementsService.createDefaultEntitlements(orgId);
    } else {
      orgId = orgResult[0].id.toString();
    }

    // Check entitlements and usage limits
    const usageLimits = await checkScanLimits(orgId);
    
    if (!usageLimits.canScan) {
      const errorMessages = {
        'scan_limit_exceeded': `Monthly scan limit exceeded. You've used all ${usageLimits.scansRemaining} scans for this billing period.`,
        'subscription_expired': 'Your subscription has expired. Please update your billing information.',
        'subscription_inactive': 'Your subscription is inactive. Please contact support.'
      };
      
      const message = errorMessages[usageLimits.reasonCode || 'scan_limit_exceeded'] || 'Scan limit exceeded';
      
      return NextResponse.json({
        error: message,
        code: usageLimits.reasonCode,
        upgradeUrl: usageLimits.upgradeUrl,
        scansRemaining: usageLimits.scansRemaining
      }, { 
        status: 402, // Payment Required
        headers 
      });
    }

    // Enforce pages per scan limit based on tier
    const maxPagesForTier = usageLimits.pagesPerScan;
    
    // Map depth to expected page count (these are estimates)
    const depthToPages = {
      'quick': Math.min(1, maxPagesForTier),
      'standard': Math.min(5, maxPagesForTier), 
      'deep': maxPagesForTier
    };
    
    const expectedPages = depthToPages[depth as keyof typeof depthToPages];

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

    // Increment usage atomically
    try {
      await incrementUsage(orgId, 1, 0); // 1 scan, 0 pages initially (pages will be updated when scan completes)
    } catch (usageError) {
      console.error('Failed to increment usage:', usageError);
      // Continue anyway - don't block scan for usage tracking failures
    }

    // Track scan started for analytics
    trackScanStarted(scan.id, url, tier, orgId);
    
    // Initialize progress tracking
    const { initializeScan } = await import('@/lib/realtime/progress');
    initializeScan(scan.id, url, expectedPages);

    // Enqueue job with scan_id reference and tier-based priority
    const { data: job, error: jobError } = await supabase
      .from('scan_jobs')
      .insert({
        scan_id: scan.id,
        org_id: orgId,
        url,
        depth,
        priority: tier === 'free' ? 10 : tier === 'professional' ? 5 : 1,
        max_pages: expectedPages // Pass the tier-based page limit to the worker
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