/**
 * Trust Page Analytics Events
 * 
 * Track engagement with the trust page and sample reports
 */

import { analytics } from './events';

export interface TrustViewedEvent {
  type: 'trust.viewed';
  latest_scan_id?: string;
  latest_scan_score?: number;
  has_sample_link: boolean;
  user_agent?: string;
  referrer?: string;
}

export interface TrustSampleClickedEvent {
  type: 'trust.sample_clicked';
  scan_id: string;
  share_url: string;
  scan_score: number;
  cta_location: 'view_sample' | 'download_pdf';
}

export interface TrustPdfDownloadedEvent {
  type: 'trust.pdf_downloaded';
  scan_id: string;
  scan_score: number;
  download_source: 'trust_page' | 'sample_report';
}

export interface TrustSelfScanScheduledEvent {
  type: 'trust.selfscan.scheduled';
  scan_id: string;
  url: string;
  triggered_by: 'cron' | 'manual';
}

export interface TrustSamplePublishedEvent {
  type: 'trust.sample.published';
  scan_id: string;
  share_url: string;
  domain: string;
  scan_score: number;
  scan_finished_at: string;
  expires_at: string;
}

export type TrustAnalyticsEvent = 
  | TrustViewedEvent
  | TrustSampleClickedEvent
  | TrustPdfDownloadedEvent
  | TrustSelfScanScheduledEvent
  | TrustSamplePublishedEvent;

/**
 * Track trust page view
 */
export function trackTrustViewed(
  latestScanId?: string,
  latestScanScore?: number,
  hasSampleLink: boolean = false,
  userAgent?: string,
  referrer?: string
): void {
  analytics.emit({
    type: 'trust.viewed',
    latest_scan_id: latestScanId,
    latest_scan_score: latestScanScore,
    has_sample_link: hasSampleLink,
    user_agent: userAgent,
    referrer,
    timestamp: new Date().toISOString()
  } as TrustViewedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trust_page_viewed', {
      latest_scan_id: latestScanId,
      latest_scan_score: latestScanScore,
      has_sample_link: hasSampleLink,
      referrer
    });
  }
}

/**
 * Track sample report clicks from trust page
 */
export function trackTrustSampleClicked(
  scanId: string,
  shareUrl: string,
  scanScore: number,
  ctaLocation: 'view_sample' | 'download_pdf'
): void {
  analytics.emit({
    type: 'trust.sample_clicked',
    scan_id: scanId,
    share_url: shareUrl,
    scan_score: scanScore,
    cta_location: ctaLocation,
    timestamp: new Date().toISOString()
  } as TrustSampleClickedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trust_sample_clicked', {
      scan_id: scanId,
      scan_score: scanScore,
      cta_location: ctaLocation,
      value: getSampleValue(ctaLocation)
    });
  }
}

/**
 * Track PDF downloads from trust page
 */
export function trackTrustPdfDownloaded(
  scanId: string,
  scanScore: number,
  downloadSource: 'trust_page' | 'sample_report'
): void {
  analytics.emit({
    type: 'trust.pdf_downloaded',
    scan_id: scanId,
    scan_score: scanScore,
    download_source: downloadSource,
    timestamp: new Date().toISOString()
  } as TrustPdfDownloadedEvent);

  // External analytics
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'trust_pdf_downloaded', {
      scan_id: scanId,
      scan_score: scanScore,
      download_source: downloadSource,
      value: 10 // High value action
    });
  }
}

/**
 * Track self-scan scheduling (from cron)
 */
export function trackTrustSelfScanScheduled(
  scanId: string,
  url: string,
  triggeredBy: 'cron' | 'manual' = 'cron'
): void {
  analytics.emit({
    type: 'trust.selfscan.scheduled',
    scan_id: scanId,
    url,
    triggered_by: triggeredBy,
    timestamp: new Date().toISOString()
  } as TrustSelfScanScheduledEvent);
}

/**
 * Track sample report publishing (from cron)
 */
export function trackTrustSamplePublished(
  scanId: string,
  shareUrl: string,
  domain: string,
  scanScore: number,
  scanFinishedAt: string,
  expiresAt: string
): void {
  analytics.emit({
    type: 'trust.sample.published',
    scan_id: scanId,
    share_url: shareUrl,
    domain,
    scan_score: scanScore,
    scan_finished_at: scanFinishedAt,
    expires_at: expiresAt,
    timestamp: new Date().toISOString()
  } as TrustSamplePublishedEvent);
}

/**
 * Get trust funnel metrics
 */
export function getTrustFunnelMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): {
  pageViews: number;
  sampleClicks: number;
  pdfDownloads: number;
  conversionRates: {
    sampleClickRate: number; // sampleClicks / pageViews
    downloadRate: number; // pdfDownloads / pageViews
  };
} {
  const events = analytics.getEvents();
  const cutoff = getTimeRangeCutoff(timeRange);
  
  const trustEvents = events.filter(e => 
    e.type.startsWith('trust.') && new Date(e.timestamp) > cutoff
  );

  const pageViews = trustEvents.filter(e => e.type === 'trust.viewed').length;
  const sampleClicks = trustEvents.filter(e => e.type === 'trust.sample_clicked').length;
  const pdfDownloads = trustEvents.filter(e => e.type === 'trust.pdf_downloaded').length;

  return {
    pageViews,
    sampleClicks,
    pdfDownloads,
    conversionRates: {
      sampleClickRate: pageViews > 0 ? (sampleClicks / pageViews) * 100 : 0,
      downloadRate: pageViews > 0 ? (pdfDownloads / pageViews) * 100 : 0
    }
  };
}

// Helper functions
function getSampleValue(ctaLocation: string): number {
  const values = {
    'view_sample': 5,
    'download_pdf': 10
  };
  return values[ctaLocation as keyof typeof values] || 1;
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