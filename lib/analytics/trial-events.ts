/**
 * Trial Analytics Events
 * 
 * Specific analytics tracking for the trial onboarding funnel
 */

import { analytics } from './events';

export interface TrialStartedEvent {
  type: 'trial.started';
  domain: string;
  trial_org_id: string;
  ip?: string;
  user_agent?: string;
  scan_id: string;
  utm_source?: string;
  utm_campaign?: string;
}

export interface TrialCompletedEvent {
  type: 'trial.completed';
  trial_org_id: string;
  scan_id: string;
  domain: string;
  duration_ms: number;
  overall_score: number;
  total_violations: number;
  critical_issues: number;
  success: boolean;
}

export interface TrialUpgradeClickedEvent {
  type: 'trial.upgrade_clicked';
  trial_org_id: string;
  scan_id?: string;
  domain: string;
  cta_location: string; // 'results_page', 'download_gate', 'nav_button'
  utm_source?: string;
}

export interface TrialUpgradedEvent {
  type: 'trial.upgraded';
  trial_org_id: string;
  new_org_id: string;
  user_email: string;
  domain: string;
  completed_scans: number;
  time_to_upgrade_ms: number;
  upgrade_tier: string;
}

export interface TrialAbandonedEvent {
  type: 'trial.abandoned';
  trial_org_id: string;
  scan_id?: string;
  domain: string;
  abandon_stage: 'form' | 'scanning' | 'results';
  time_on_page_ms: number;
}

export interface TrialBlockedEvent {
  type: 'trial.blocked';
  domain: string;
  ip?: string;
  block_reason: 'rate_limit_ip' | 'rate_limit_domain' | 'invalid_url' | 'ssrf_protection';
  attempted_url: string;
}

export type TrialAnalyticsEvent = 
  | TrialStartedEvent
  | TrialCompletedEvent
  | TrialUpgradeClickedEvent
  | TrialUpgradedEvent
  | TrialAbandonedEvent
  | TrialBlockedEvent;

/**
 * Track trial started event
 */
export function trackTrialStarted(
  trialOrgId: string,
  scanId: string,
  domain: string,
  ip?: string,
  userAgent?: string,
  utmParams?: { source?: string; campaign?: string }
): void {
  analytics.emit({
    type: 'trial.started',
    trial_org_id: trialOrgId,
    scan_id: scanId,
    domain,
    ip,
    user_agent: userAgent,
    utm_source: utmParams?.source,
    utm_campaign: utmParams?.campaign,
    timestamp: new Date().toISOString()
  } as TrialStartedEvent);

  // Also send to external analytics if available
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trial_started', {
      domain,
      trial_org_id: trialOrgId,
      scan_id: scanId,
      utm_source: utmParams?.source,
      utm_campaign: utmParams?.campaign
    });
  }
}

/**
 * Track trial completed event
 */
export function trackTrialCompleted(
  trialOrgId: string,
  scanId: string,
  domain: string,
  startTime: string,
  results: {
    overall_score: number;
    total_violations: number;
    critical_issues: number;
    success: boolean;
  }
): void {
  const duration = Date.now() - new Date(startTime).getTime();

  analytics.emit({
    type: 'trial.completed',
    trial_org_id: trialOrgId,
    scan_id: scanId,
    domain,
    duration_ms: duration,
    ...results,
    timestamp: new Date().toISOString()
  } as TrialCompletedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trial_completed', {
      domain,
      trial_org_id: trialOrgId,
      scan_id: scanId,
      overall_score: results.overall_score,
      total_violations: results.total_violations,
      duration_seconds: Math.round(duration / 1000),
      success: results.success
    });
  }
}

/**
 * Track upgrade CTA clicks
 */
export function trackTrialUpgradeClicked(
  trialOrgId: string,
  domain: string,
  ctaLocation: string,
  scanId?: string,
  utmSource?: string
): void {
  analytics.emit({
    type: 'trial.upgrade_clicked',
    trial_org_id: trialOrgId,
    scan_id: scanId,
    domain,
    cta_location: ctaLocation,
    utm_source: utmSource,
    timestamp: new Date().toISOString()
  } as TrialUpgradeClickedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trial_upgrade_clicked', {
      domain,
      trial_org_id: trialOrgId,
      cta_location: ctaLocation,
      utm_source: utmSource
    });
  }
}

/**
 * Track successful trial upgrade
 */
export function trackTrialUpgraded(
  trialOrgId: string,
  newOrgId: string,
  userEmail: string,
  domain: string,
  trialStartTime: string,
  completedScans: number,
  upgradeTier: string
): void {
  const timeToUpgrade = Date.now() - new Date(trialStartTime).getTime();

  analytics.emit({
    type: 'trial.upgraded',
    trial_org_id: trialOrgId,
    new_org_id: newOrgId,
    user_email: userEmail,
    domain,
    completed_scans: completedScans,
    time_to_upgrade_ms: timeToUpgrade,
    upgrade_tier: upgradeTier,
    timestamp: new Date().toISOString()
  } as TrialUpgradedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trial_upgraded', {
      domain,
      trial_org_id: trialOrgId,
      new_org_id: newOrgId,
      completed_scans: completedScans,
      time_to_upgrade_hours: Math.round(timeToUpgrade / (1000 * 60 * 60)),
      upgrade_tier: upgradeTier,
      value: getTierValue(upgradeTier)
    });
  }
}

/**
 * Track trial abandonment
 */
export function trackTrialAbandoned(
  trialOrgId: string,
  domain: string,
  abandonStage: 'form' | 'scanning' | 'results',
  timeOnPage: number,
  scanId?: string
): void {
  analytics.emit({
    type: 'trial.abandoned',
    trial_org_id: trialOrgId,
    scan_id: scanId,
    domain,
    abandon_stage: abandonStage,
    time_on_page_ms: timeOnPage,
    timestamp: new Date().toISOString()
  } as TrialAbandonedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trial_abandoned', {
      domain,
      trial_org_id: trialOrgId,
      abandon_stage: abandonStage,
      time_on_page_seconds: Math.round(timeOnPage / 1000)
    });
  }
}

/**
 * Track trial blocks (rate limits, invalid URLs, etc.)
 */
export function trackTrialBlocked(
  domain: string,
  blockReason: string,
  attemptedUrl: string,
  ip?: string
): void {
  analytics.emit({
    type: 'trial.blocked',
    domain,
    ip,
    block_reason: blockReason as any,
    attempted_url: attemptedUrl,
    timestamp: new Date().toISOString()
  } as TrialBlockedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trial_blocked', {
      domain,
      block_reason: blockReason,
      attempted_url: attemptedUrl
    });
  }
}

/**
 * Get trial funnel metrics
 */
export function getTrialFunnelMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): {
  started: number;
  completed: number;
  upgradeClicked: number;
  upgraded: number;
  abandoned: number;
  blocked: number;
  conversionRates: {
    completionRate: number; // completed / started
    upgradeClickRate: number; // upgradeClicked / completed
    conversionRate: number; // upgraded / completed
  };
} {
  const events = analytics.getEvents();
  const cutoff = getTimeRangeCutoff(timeRange);
  
  const trialEvents = events.filter(e => 
    e.type.startsWith('trial.') && new Date(e.timestamp) > cutoff
  );

  const started = trialEvents.filter(e => e.type === 'trial.started').length;
  const completed = trialEvents.filter(e => e.type === 'trial.completed').length;
  const upgradeClicked = trialEvents.filter(e => e.type === 'trial.upgrade_clicked').length;
  const upgraded = trialEvents.filter(e => e.type === 'trial.upgraded').length;
  const abandoned = trialEvents.filter(e => e.type === 'trial.abandoned').length;
  const blocked = trialEvents.filter(e => e.type === 'trial.blocked').length;

  return {
    started,
    completed,
    upgradeClicked,
    upgraded,
    abandoned,
    blocked,
    conversionRates: {
      completionRate: started > 0 ? (completed / started) * 100 : 0,
      upgradeClickRate: completed > 0 ? (upgradeClicked / completed) * 100 : 0,
      conversionRate: completed > 0 ? (upgraded / completed) * 100 : 0
    }
  };
}

// Helper functions
function getTierValue(tier: string): number {
  const values = {
    'starter': 29,
    'pro': 99,
    'enterprise': 499
  };
  return values[tier as keyof typeof values] || 0;
}

function getTimeRangeCutoff(range: string): Date {
  const now = new Date();
  switch (range) {
    case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
    case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}