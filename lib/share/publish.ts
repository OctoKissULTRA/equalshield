/**
 * Share Link Publishing for Sample Reports
 * 
 * Creates and manages share links for public sample reports
 */

import { createSupabaseClient } from '@/lib/supabase/server';
import { newRawToken, hashToken } from '@/lib/share';

export interface ShareLinkOptions {
  scanId: string;
  ttlDays?: number;
  maxViews?: number;
  watermark?: boolean;
}

/**
 * Create a share link for a scan
 */
export async function createShareLinkForScan(options: ShareLinkOptions): Promise<{
  url: string;
  token: string;
  expiresAt: Date;
}> {
  const {
    scanId,
    ttlDays = 14,
    maxViews = 500,
    watermark = false
  } = options;

  const supabase = createSupabaseClient();

  // Get scan details to verify it exists and get org_id
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select('id, org_id, status')
    .eq('id', scanId)
    .single();

  if (scanError || !scan) {
    throw new Error(`Scan not found: ${scanId}`);
  }

  if (scan.status !== 'completed') {
    throw new Error(`Scan not completed: ${scanId}`);
  }

  // Generate secure token
  const rawToken = newRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  // Revoke any existing share links for this scan to prevent accumulation
  await supabase
    .from('share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('scan_id', scanId)
    .is('revoked_at', null);

  // Create new share token
  const { data: shareToken, error: shareError } = await supabase
    .from('share_tokens')
    .insert({
      org_id: scan.org_id,
      scan_id: scanId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      max_views: maxViews,
      views: 0,
      watermark: watermark
    })
    .select('id')
    .single();

  if (shareError) {
    throw new Error(`Failed to create share token: ${shareError.message}`);
  }

  const shareUrl = `/r/${rawToken}`;
  
  console.log(`Share link created for scan ${scanId}: ${shareUrl} (expires: ${expiresAt.toISOString()})`);

  return {
    url: shareUrl,
    token: rawToken,
    expiresAt
  };
}

/**
 * Get the latest sample share URL for a scan ID
 */
export async function getLatestSampleShareUrl(scanId: string | null): Promise<string | null> {
  if (!scanId) return null;

  const supabase = createSupabaseClient();

  // Find the most recent active share token for this scan
  const { data: shareToken, error } = await supabase
    .from('share_tokens')
    .select('token_hash, expires_at, revoked_at')
    .eq('scan_id', scanId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !shareToken) {
    return null;
  }

  // Note: We can't reconstruct the raw token from the hash
  // This function should be used after the publish cron has run
  // and we have the URL stored elsewhere, or we generate a new one
  return null;
}

/**
 * Get the latest share URL from a cache/store
 * This would typically be stored in a KV store or database
 */
export async function getStoredSampleShareUrl(): Promise<string | null> {
  // In a real implementation, this would fetch from Redis/KV store
  // For now, we'll fetch the latest share token and create a new one if needed
  
  const supabase = createSupabaseClient();
  
  // Get the domain from environment
  const domain = process.env.SELF_SCAN_URL ? new URL(process.env.SELF_SCAN_URL).hostname : 'equalshield.com';
  
  // Find the latest completed scan for our domain
  const { data: scan, error: scanError } = await supabase
    .from('scans')
    .select('id, finished_at')
    .eq('domain', domain)
    .eq('status', 'completed')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .single();

  if (scanError || !scan) {
    return null;
  }

  // Check if there's an active share token for this scan
  const { data: shareToken, error: tokenError } = await supabase
    .from('share_tokens')
    .select('id, created_at')
    .eq('scan_id', scan.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (tokenError || !shareToken) {
    // No active share token, we should create one via the publish cron
    return null;
  }

  // We have an active token but can't reconstruct the URL from the hash
  // This indicates the publish cron should store the URL in a KV store
  // For now, return a placeholder that indicates a share link exists
  return `/r/[latest-sample]`;
}

/**
 * Store the sample share URL in a simple cache
 * In production, use Redis or similar
 */
let sampleShareUrlCache: { url: string; scanId: string; createdAt: Date } | null = null;

export function storeSampleShareUrl(url: string, scanId: string): void {
  sampleShareUrlCache = {
    url,
    scanId,
    createdAt: new Date()
  };
}

export function getCachedSampleShareUrl(): string | null {
  if (!sampleShareUrlCache) return null;
  
  // Check if cache is older than 7 days
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  if (Date.now() - sampleShareUrlCache.createdAt.getTime() > maxAge) {
    sampleShareUrlCache = null;
    return null;
  }
  
  return sampleShareUrlCache.url;
}

/**
 * Validate that a share token is active and usable
 */
export async function validateShareToken(token: string): Promise<boolean> {
  const supabase = createSupabaseClient();
  const tokenHash = hashToken(token);

  const { data: shareToken, error } = await supabase
    .from('share_tokens')
    .select('id, expires_at, revoked_at, max_views, views')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !shareToken) {
    return false;
  }

  // Check if revoked
  if (shareToken.revoked_at) {
    return false;
  }

  // Check if expired
  if (new Date(shareToken.expires_at) < new Date()) {
    return false;
  }

  // Check view limit
  if (shareToken.views >= shareToken.max_views) {
    return false;
  }

  return true;
}