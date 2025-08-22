/**
 * Scan Scheduler
 * 
 * Utilities for scheduling and managing accessibility scans
 */

import { createSupabaseClient } from '@/lib/supabase/server';
import { initializeScan } from '@/lib/realtime/progress';
import { trackScanStarted } from '@/lib/analytics/events';

export interface ScanOptions {
  orgId: string;
  url: string;
  email?: string;
  depth?: 'quick' | 'standard' | 'comprehensive';
  maxPages?: number;
  maxDurationMs?: number;
  priority?: number;
  isTrial?: boolean;
  trialOrgId?: string;
}

/**
 * Schedule a new accessibility scan
 */
export async function scheduleScan(options: ScanOptions): Promise<string> {
  const {
    orgId,
    url,
    email = 'system@equalshield.com',
    depth = 'standard',
    maxPages = 50,
    maxDurationMs = 300000, // 5 minutes default
    priority = 10,
    isTrial = false,
    trialOrgId
  } = options;

  const supabase = createSupabaseClient();

  // Create scan record
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .insert({
      url,
      org_id: orgId,
      email,
      depth,
      status: 'pending',
      is_trial: isTrial,
      trial_org_id: trialOrgId || null
    })
    .select('id')
    .single();

  if (scanError) {
    console.error('Scan creation error:', scanError);
    throw new Error(`Failed to create scan: ${scanError.message}`);
  }

  // Initialize progress tracking for real-time updates
  initializeScan(scan.id, url, maxPages);

  // Track analytics event
  trackScanStarted(scan.id, url, isTrial ? 'trial' : 'paid', orgId);

  // Schedule the scan job
  const { data: job, error: jobError } = await supabase
    .from('scan_jobs')
    .insert({
      scan_id: scan.id,
      org_id: orgId,
      url,
      depth,
      priority,
      max_pages: maxPages,
      max_duration_ms: maxDurationMs
    })
    .select('id')
    .single();

  if (jobError) {
    console.error('Scan job creation error:', jobError);
    throw new Error(`Failed to queue scan job: ${jobError.message}`);
  }

  console.log(`Scan scheduled: ${scan.id} (job: ${job.id})`);
  return scan.id;
}

/**
 * Get scan status
 */
export async function getScanStatus(scanId: string) {
  const supabase = createSupabaseClient();

  const { data: scan, error } = await supabase
    .from('scans')
    .select('id, url, status, created_at, finished_at, score, pour_scores')
    .eq('id', scanId)
    .single();

  if (error) {
    throw new Error(`Failed to get scan status: ${error.message}`);
  }

  return scan;
}

/**
 * Get latest scan for a domain
 */
export async function getLatestScanForDomain(domain: string, orgId?: string) {
  const supabase = createSupabaseClient();

  let query = supabase
    .from('scans')
    .select('id, url, status, created_at, finished_at, score, pour_scores, domain')
    .eq('domain', domain)
    .eq('status', 'completed')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1);

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data: scans, error } = await query;

  if (error) {
    throw new Error(`Failed to get latest scan: ${error.message}`);
  }

  return scans?.[0] || null;
}

/**
 * Default scan limits by depth
 */
export const SCAN_LIMITS = {
  quick: {
    maxPages: 15,
    maxDurationMs: 180000, // 3 minutes
    priority: 20
  },
  standard: {
    maxPages: 50,
    maxDurationMs: 300000, // 5 minutes
    priority: 10
  },
  comprehensive: {
    maxPages: 200,
    maxDurationMs: 600000, // 10 minutes
    priority: 5
  },
  self_scan: {
    maxPages: 50,
    maxDurationMs: 600000, // 10 minutes for self-scans
    priority: 1 // Highest priority
  }
} as const;