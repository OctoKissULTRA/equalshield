export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { validateScanUrl } from '@/lib/security/url-guard';
import { 
  createTrialOrg, 
  checkTrialRateLimit, 
  setTrialCookie,
  TRIAL_LIMITS 
} from '@/lib/trial';
import { createSupabaseClient } from '@/lib/supabase/server';
import { initializeScan } from '@/lib/realtime/progress';
import { trackScanStarted } from '@/lib/analytics/events';
import { trackTrialStarted } from '@/lib/analytics/trial-events';

/**
 * POST /api/trial/start
 * 
 * Start a new trial accessibility scan without requiring account creation
 */
export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    // Validate required fields
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // SSRF protection - validate URL is public and safe
    const urlValidation = await validateScanUrl(url);
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error || 'Invalid URL' },
        { status: 400 }
      );
    }

    // Get client information
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = req.headers.get('user-agent') || '';
    const domain = new URL(url).hostname;

    // Check rate limits
    const rateLimitCheck = await checkTrialRateLimit(ip, domain);
    if (!rateLimitCheck.allowed) {
      const errorMessages = {
        'rate_limit_ip': 'Too many trial scans from this IP address. Please try again later.',
        'rate_limit_domain': 'Too many trial scans for this domain today. Please try again later.'
      };

      return NextResponse.json(
        { 
          error: errorMessages[rateLimitCheck.reasonCode as keyof typeof errorMessages] || 'Rate limit exceeded',
          retryAfter: rateLimitCheck.retryAfter 
        },
        { 
          status: 429,
          headers: rateLimitCheck.retryAfter ? {
            'Retry-After': rateLimitCheck.retryAfter.toString()
          } : undefined
        }
      );
    }

    // Create trial organization and session
    const { trialOrg, cookieId } = await createTrialOrg(url, ip, userAgent);

    // Create scan record
    const supabase = createSupabaseClient();
    
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        url,
        org_id: trialOrg.id,
        email: 'trial@equalshield.com', // Placeholder email for trials
        depth: 'quick', // Force quick scans for trials
        status: 'pending',
        is_trial: true,
        trial_org_id: trialOrg.id
      })
      .select('id')
      .single();

    if (scanError) {
      console.error('Trial scan creation error:', scanError);
      return NextResponse.json(
        { error: 'Failed to create trial scan' },
        { status: 500 }
      );
    }

    // Initialize progress tracking for real-time updates
    initializeScan(scan.id, url, TRIAL_LIMITS.pages_per_scan);

    // Track analytics events
    trackScanStarted(scan.id, url, 'trial', trialOrg.id);
    trackTrialStarted(trialOrg.id, scan.id, domain, ip, userAgent);

    // Schedule the scan job with trial limits
    const { data: job, error: jobError } = await supabase
      .from('scan_jobs')
      .insert({
        scan_id: scan.id,
        org_id: trialOrg.id,
        url,
        depth: 'quick',
        priority: 20, // Lower priority than paid scans
        max_pages: TRIAL_LIMITS.pages_per_scan,
        max_duration_ms: TRIAL_LIMITS.max_duration_ms
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Trial job queue error:', jobError);
      return NextResponse.json(
        { error: 'Failed to queue trial scan' },
        { status: 500 }
      );
    }

    // Set trial cookie and return response
    const [cookieHeader, cookieValue] = setTrialCookie(cookieId);

    return NextResponse.json({
      success: true,
      scanId: scan.id,
      trialId: trialOrg.id,
      message: 'Trial scan started successfully',
      statusUrl: `/api/progress/${scan.id}`,
      limits: {
        pages_per_scan: TRIAL_LIMITS.pages_per_scan,
        max_duration_ms: TRIAL_LIMITS.max_duration_ms,
        expires_at: trialOrg.expires_at
      },
      estimatedTime: '60 seconds'
    }, {
      headers: {
        [cookieHeader]: cookieValue
      }
    });

  } catch (error) {
    console.error('Trial start error:', error);
    return NextResponse.json(
      { error: 'Failed to start trial scan' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trial/start
 * 
 * Get trial status and available limits
 */
export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';

    // Check rate limits without consuming
    const rateLimitCheck = await checkTrialRateLimit(ip);

    return NextResponse.json({
      available: rateLimitCheck.allowed,
      limits: TRIAL_LIMITS,
      rateLimit: {
        allowed: rateLimitCheck.allowed,
        reasonCode: rateLimitCheck.reasonCode,
        retryAfter: rateLimitCheck.retryAfter
      }
    });

  } catch (error) {
    console.error('Trial status error:', error);
    return NextResponse.json(
      { error: 'Failed to get trial status' },
      { status: 500 }
    );
  }
}