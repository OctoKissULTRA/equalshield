/**
 * Analytics and Instrumentation Events
 * 
 * Emits events for dashboard visibility and product metrics
 */

interface BaseEvent {
  timestamp: string;
  sessionId?: string;
  userId?: string;
  orgId?: string;
}

export interface ScanEvent extends BaseEvent {
  type: 'scan.scheduled' | 'scan.started' | 'scan.completed' | 'scan.failed';
  scanId: string;
  url: string;
  domain: string;
  tier: string;
  metadata?: {
    duration?: number;
    pageCount?: number;
    violationCount?: number;
    topSeverity?: 'critical' | 'serious' | 'moderate' | 'minor';
    quickWins?: number;
    overallScore?: number;
    wcagCompliance?: {
      levelA: boolean;
      levelAA: boolean;
    };
  };
}

export interface CrawlEvent extends BaseEvent {
  type: 'scan.page.crawled';
  scanId: string;
  pageUrl: string;
  domain: string;
  crawlDepth: number;
  duration: number;
  violationsFound: number;
  httpStatus: number;
}

export interface ReportEvent extends BaseEvent {
  type: 'report.generated' | 'vpat.generated';
  scanId: string;
  format: 'pdf' | 'html';
  domain: string;
  generationTime: number;
  fileSize?: number;
}

export interface SecurityEvent extends BaseEvent {
  type: 'scan.blocked_url' | 'auth.failed' | 'rate_limit.exceeded';
  domain?: string;
  reason: string;
  clientIp?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceEvent extends BaseEvent {
  type: 'performance.scan' | 'performance.report' | 'performance.api';
  operation: string;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

export type AnalyticsEvent = ScanEvent | CrawlEvent | ReportEvent | SecurityEvent | PerformanceEvent;

export class EventTracker {
  private static instance: EventTracker;
  private events: AnalyticsEvent[] = [];
  
  static getInstance(): EventTracker {
    if (!EventTracker.instance) {
      EventTracker.instance = new EventTracker();
    }
    return EventTracker.instance;
  }
  
  emit(event: AnalyticsEvent): void {
    const enrichedEvent = {
      ...event,
      timestamp: new Date().toISOString()
    };
    
    this.events.push(enrichedEvent);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Analytics Event: ${event.type}`, enrichedEvent);
    }
    
    // In production, send to analytics service
    if (process.env.NODE_ENV === 'production') {
      this.sendToAnalytics(enrichedEvent);
    }
  }
  
  private async sendToAnalytics(event: AnalyticsEvent): Promise<void> {
    try {
      // Could send to various analytics services:
      // - PostHog
      // - Mixpanel  
      // - Custom analytics endpoint
      // - Database for internal dashboards
      
      // For now, just store in database for dashboard
      await this.storeInDatabase(event);
    } catch (error) {
      console.error('Failed to send analytics event:', error);
    }
  }
  
  private async storeInDatabase(event: AnalyticsEvent): Promise<void> {
    // Store analytics events in database for dashboard
    // This would connect to your analytics tables
    try {
      // Example: INSERT INTO analytics_events (type, data, timestamp) VALUES (?, ?, ?)
      console.log('Storing analytics event:', event.type);
    } catch (error) {
      console.error('Failed to store analytics event in database:', error);
    }
  }
  
  // Get events for testing/debugging
  getEvents(): AnalyticsEvent[] {
    return [...this.events];
  }
  
  // Clear events (for testing)
  clearEvents(): void {
    this.events = [];
  }
  
  // Dashboard metrics helpers
  getScanMetrics(timeRange: '1h' | '24h' | '7d' | '30d' = '24h'): {
    totalScans: number;
    avgDuration: number;
    avgScore: number;
    topDomains: Array<{ domain: string; count: number }>;
    severityTrend: Array<{ severity: string; count: number }>;
    quickWinsTotal: number;
  } {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    const scanEvents = this.events.filter(e => 
      e.type === 'scan.completed' && new Date(e.timestamp) > cutoff
    ) as ScanEvent[];
    
    const domains = new Map<string, number>();
    const severities = new Map<string, number>();
    let totalDuration = 0;
    let totalScore = 0;
    let totalQuickWins = 0;
    
    scanEvents.forEach(event => {
      domains.set(event.domain, (domains.get(event.domain) || 0) + 1);
      
      if (event.metadata) {
        if (event.metadata.duration) totalDuration += event.metadata.duration;
        if (event.metadata.overallScore) totalScore += event.metadata.overallScore;
        if (event.metadata.quickWins) totalQuickWins += event.metadata.quickWins;
        if (event.metadata.topSeverity) {
          severities.set(event.metadata.topSeverity, (severities.get(event.metadata.topSeverity) || 0) + 1);
        }
      }
    });
    
    return {
      totalScans: scanEvents.length,
      avgDuration: scanEvents.length > 0 ? Math.round(totalDuration / scanEvents.length) : 0,
      avgScore: scanEvents.length > 0 ? Math.round(totalScore / scanEvents.length) : 0,
      topDomains: Array.from(domains.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      severityTrend: Array.from(severities.entries())
        .map(([severity, count]) => ({ severity, count })),
      quickWinsTotal: totalQuickWins
    };
  }
  
  private getTimeRangeCutoff(range: string): Date {
    const now = new Date();
    switch (range) {
      case '1h': return new Date(now.getTime() - 60 * 60 * 1000);
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }
}

// Convenience functions for common events
export const analytics = EventTracker.getInstance();

export function trackScanStarted(scanId: string, url: string, tier: string, orgId?: string): void {
  analytics.emit({
    type: 'scan.started',
    scanId,
    url,
    domain: new URL(url).hostname,
    tier,
    orgId
  });
}

export function trackScanCompleted(
  scanId: string, 
  url: string, 
  tier: string, 
  duration: number,
  results: {
    pageCount: number;
    violationCount: number;
    topSeverity?: 'critical' | 'serious' | 'moderate' | 'minor';
    quickWins: number;
    overallScore: number;
    wcagCompliance: { levelA: boolean; levelAA: boolean };
  },
  orgId?: string
): void {
  analytics.emit({
    type: 'scan.completed',
    scanId,
    url,
    domain: new URL(url).hostname,
    tier,
    orgId,
    metadata: {
      duration,
      ...results
    }
  });
}

export function trackPageCrawled(
  scanId: string,
  pageUrl: string,
  crawlDepth: number,
  duration: number,
  violationsFound: number,
  httpStatus: number
): void {
  analytics.emit({
    type: 'scan.page.crawled',
    scanId,
    pageUrl,
    domain: new URL(pageUrl).hostname,
    crawlDepth,
    duration,
    violationsFound,
    httpStatus
  });
}

export function trackReportGenerated(
  scanId: string,
  domain: string,
  format: 'pdf' | 'html',
  generationTime: number,
  fileSize?: number
): void {
  analytics.emit({
    type: 'report.generated',
    scanId,
    domain,
    format,
    generationTime,
    fileSize
  });
}

export function trackVPATGenerated(
  scanId: string,
  domain: string,
  format: 'pdf' | 'html',
  generationTime: number,
  fileSize?: number
): void {
  analytics.emit({
    type: 'vpat.generated',
    scanId,
    domain,
    format,
    generationTime,
    fileSize
  });
}

export function trackBlockedUrl(url: string, reason: string, clientIp?: string): void {
  analytics.emit({
    type: 'scan.blocked_url',
    domain: new URL(url).hostname,
    reason,
    clientIp
  });
}

export function trackAuthFailure(reason: string, clientIp?: string, userAgent?: string): void {
  analytics.emit({
    type: 'auth.failed',
    reason,
    clientIp,
    userAgent
  });
}

export function trackRateLimitExceeded(clientIp: string, endpoint: string): void {
  analytics.emit({
    type: 'rate_limit.exceeded',
    reason: `Rate limit exceeded for ${endpoint}`,
    clientIp,
    metadata: { endpoint }
  });
}