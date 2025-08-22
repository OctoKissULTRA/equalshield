/**
 * Trial System for Zero-Friction Onboarding
 * 
 * Handles anonymous trial scans, session management, and upgrade migration
 */

import crypto from 'node:crypto';
import { createSupabaseClient } from '@/lib/supabase/server';

export interface TrialLimits {
  pages_per_scan: number;
  scans_remaining: number;
  max_duration_ms: number;
  expires_in_days: number;
}

export interface TrialSession {
  id: string;
  trial_org_id: string;
  cookie_id: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}

export interface TrialOrg {
  id: string;
  domain: string;
  pages_per_scan: number;
  scans_remaining: number;
  completed_scans: number;
  created_at: string;
  expires_at: string;
  upgraded_at?: string;
  upgraded_to_org_id?: string;
}

// Trial limits configuration
export const TRIAL_LIMITS: TrialLimits = {
  pages_per_scan: 5,
  scans_remaining: 1,
  max_duration_ms: 60_000, // 60 seconds
  expires_in_days: 7
};

// Rate limiting constants
export const TRIAL_RATE_LIMITS = {
  max_trials_per_ip_per_day: 10,
  max_trials_per_domain_per_day: 5,
  cooldown_minutes_after_limit: 60
};

/**
 * Generate a secure trial session cookie ID
 */
export function generateTrialCookieId(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Create a new trial organization and session
 */
export async function createTrialOrg(
  url: string, 
  ip?: string, 
  userAgent?: string
): Promise<{ trialOrg: TrialOrg; cookieId: string }> {
  const supabase = createSupabaseClient();
  const domain = new URL(url).hostname;
  const cookieId = generateTrialCookieId();
  const expiresAt = new Date(Date.now() + TRIAL_LIMITS.expires_in_days * 24 * 60 * 60 * 1000);

  // Create trial organization
  const { data: trialOrg, error: orgError } = await supabase
    .from('trial_orgs')
    .insert({
      domain,
      pages_per_scan: TRIAL_LIMITS.pages_per_scan,
      scans_remaining: TRIAL_LIMITS.scans_remaining,
      expires_at: expiresAt.toISOString(),
      ip,
      user_agent: userAgent
    })
    .select()
    .single();

  if (orgError) {
    throw new Error(`Failed to create trial org: ${orgError.message}`);
  }

  // Create trial session
  const { data: session, error: sessionError } = await supabase
    .from('trial_sessions')
    .insert({
      trial_org_id: trialOrg.id,
      cookie_id: cookieId,
      expires_at: expiresAt.toISOString(),
      user_agent: userAgent,
      ip
    })
    .select()
    .single();

  if (sessionError) {
    throw new Error(`Failed to create trial session: ${sessionError.message}`);
  }

  return { 
    trialOrg: trialOrg as TrialOrg, 
    cookieId 
  };
}

/**
 * Get trial session by cookie ID
 */
export async function getTrialSession(cookieId: string): Promise<{
  session: TrialSession;
  trialOrg: TrialOrg;
} | null> {
  const supabase = createSupabaseClient();

  const { data: session, error } = await supabase
    .from('trial_sessions')
    .select(`
      *,
      trial_orgs!inner(*)
    `)
    .eq('cookie_id', cookieId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !session) {
    return null;
  }

  // Update last seen
  await supabase
    .from('trial_sessions')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', session.id);

  return {
    session: session as TrialSession,
    trialOrg: session.trial_orgs as TrialOrg
  };
}

/**
 * Check if trial has remaining scans
 */
export async function checkTrialLimits(trialOrgId: string): Promise<{
  canScan: boolean;
  scansRemaining: number;
  reasonCode?: string;
}> {
  const supabase = createSupabaseClient();

  const { data: trialOrg, error } = await supabase
    .from('trial_orgs')
    .select('scans_remaining, completed_scans, expires_at, upgraded_at')
    .eq('id', trialOrgId)
    .single();

  if (error || !trialOrg) {
    return { canScan: false, scansRemaining: 0, reasonCode: 'trial_not_found' };
  }

  // Check if expired
  if (new Date(trialOrg.expires_at) < new Date()) {
    return { canScan: false, scansRemaining: 0, reasonCode: 'trial_expired' };
  }

  // Check if upgraded (should use real org limits)
  if (trialOrg.upgraded_at) {
    return { canScan: false, scansRemaining: 0, reasonCode: 'trial_upgraded' };
  }

  // Check scan limits
  if (trialOrg.scans_remaining <= 0) {
    return { canScan: false, scansRemaining: 0, reasonCode: 'trial_limit_exceeded' };
  }

  return { 
    canScan: true, 
    scansRemaining: trialOrg.scans_remaining 
  };
}

/**
 * Consume a trial scan (decrement remaining count)
 */
export async function consumeTrialScan(trialOrgId: string): Promise<boolean> {
  const supabase = createSupabaseClient();

  const { error } = await supabase.rpc('consume_trial_scan', { 
    trial_org_id: trialOrgId 
  });

  return !error;
}

/**
 * Rate limiting check for trial creation
 */
export async function checkTrialRateLimit(ip: string, domain?: string): Promise<{
  allowed: boolean;
  reasonCode?: string;
  retryAfter?: number;
}> {
  const supabase = createSupabaseClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Check IP-based rate limit
  const { data: ipTrials, error: ipError } = await supabase
    .from('trial_orgs')
    .select('id')
    .eq('ip', ip)
    .gte('created_at', oneDayAgo.toISOString());

  if (ipError) {
    console.error('Rate limit check failed:', ipError);
    return { allowed: true }; // Fail open
  }

  if (ipTrials && ipTrials.length >= TRIAL_RATE_LIMITS.max_trials_per_ip_per_day) {
    return { 
      allowed: false, 
      reasonCode: 'rate_limit_ip',
      retryAfter: TRIAL_RATE_LIMITS.cooldown_minutes_after_limit * 60 
    };
  }

  // Check domain-based rate limit if domain provided
  if (domain) {
    const { data: domainTrials, error: domainError } = await supabase
      .from('trial_orgs')
      .select('id')
      .eq('domain', domain)
      .gte('created_at', oneDayAgo.toISOString());

    if (!domainError && domainTrials && domainTrials.length >= TRIAL_RATE_LIMITS.max_trials_per_domain_per_day) {
      return { 
        allowed: false, 
        reasonCode: 'rate_limit_domain',
        retryAfter: TRIAL_RATE_LIMITS.cooldown_minutes_after_limit * 60 
      };
    }
  }

  return { allowed: true };
}

/**
 * Migrate trial data to a real organization
 */
export async function migrateTrialToOrg(
  trialOrgId: string, 
  destinationOrgId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createSupabaseClient();

  try {
    // Use the SQL function for atomic migration
    const { data, error } = await supabase.rpc('migrate_trial_to_org', {
      p_trial_org_id: trialOrgId,
      p_dest_org_id: destinationOrgId
    });

    if (error) {
      throw error;
    }

    return { success: data === true };
  } catch (error) {
    console.error('Trial migration failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Migration failed' 
    };
  }
}

/**
 * Get trial analytics data
 */
export async function getTrialAnalytics(days: number = 30): Promise<{
  totalTrials: number;
  completedTrials: number;
  upgradedTrials: number;
  conversionRate: number;
  topDomains: Array<{ domain: string; count: number }>;
}> {
  const supabase = createSupabaseClient();
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { data: trials, error } = await supabase
    .from('trial_orgs')
    .select('domain, completed_scans, upgraded_at')
    .gte('created_at', cutoff.toISOString());

  if (error) {
    console.error('Failed to get trial analytics:', error);
    return {
      totalTrials: 0,
      completedTrials: 0,
      upgradedTrials: 0,
      conversionRate: 0,
      topDomains: []
    };
  }

  const totalTrials = trials.length;
  const completedTrials = trials.filter(t => t.completed_scans > 0).length;
  const upgradedTrials = trials.filter(t => t.upgraded_at).length;
  const conversionRate = completedTrials > 0 ? (upgradedTrials / completedTrials) * 100 : 0;

  // Count domains
  const domainCounts = trials.reduce((acc, trial) => {
    acc[trial.domain] = (acc[trial.domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topDomains = Object.entries(domainCounts)
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalTrials,
    completedTrials,
    upgradedTrials,
    conversionRate: Math.round(conversionRate * 100) / 100,
    topDomains
  };
}

/**
 * Cookie utilities
 */
export const TRIAL_COOKIE_NAME = 'equalshield_trial';
export const TRIAL_COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days

export function setTrialCookie(cookieId: string): [string, string] {
  return [
    'Set-Cookie',
    `${TRIAL_COOKIE_NAME}=${cookieId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TRIAL_COOKIE_MAX_AGE}`
  ];
}

export function getTrialCookieId(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const trialCookie = cookies.find(c => c.startsWith(`${TRIAL_COOKIE_NAME}=`));
  
  return trialCookie ? trialCookie.split('=')[1] : null;
}