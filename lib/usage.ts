/**
 * Usage Accounting & Tracking
 * 
 * Handles accurate usage reporting when scans complete
 */

import { incrementUsage, entitlementsService } from './entitlements';
import { trackScanCompleted, trackPageCrawled } from './analytics/events';

export interface ScanCompletionData {
  scanId: string;
  orgId: string;
  url: string;
  pageCount: number;
  violationCount: number;
  topSeverity?: 'critical' | 'serious' | 'moderate' | 'minor';
  quickWins: number;
  overallScore: number;
  wcagCompliance: {
    levelA: boolean;
    levelAA: boolean;
  };
  duration: number; // milliseconds
  tier: string;
}

export interface PageCrawlData {
  scanId: string;
  pageUrl: string;
  crawlDepth: number;
  duration: number;
  violationsFound: number;
  httpStatus: number;
}

export class UsageAccountant {
  
  /**
   * Called when a scan completes successfully
   * Updates page usage and tracks analytics
   */
  static async onScanComplete(data: ScanCompletionData): Promise<void> {
    try {
      // Update page usage (we already incremented scan count when scan started)
      await incrementUsage(data.orgId, 0, data.pageCount);
      
      // Track analytics
      trackScanCompleted(
        data.scanId,
        data.url,
        data.tier,
        data.duration,
        {
          pageCount: data.pageCount,
          violationCount: data.violationCount,
          topSeverity: data.topSeverity,
          quickWins: data.quickWins,
          overallScore: data.overallScore,
          wcagCompliance: data.wcagCompliance
        },
        data.orgId
      );

      // Log completion event
      await entitlementsService.logBillingEvent(
        data.orgId,
        'scan_completed',
        {
          scan_id: data.scanId,
          url: data.url,
          pages_crawled: data.pageCount,
          violations_found: data.violationCount,
          duration_ms: data.duration,
          overall_score: data.overallScore,
          tier: data.tier
        }
      );

      console.log(`✅ Usage updated for org ${data.orgId}: +${data.pageCount} pages`);
      
    } catch (error) {
      console.error('Failed to update scan completion usage:', error);
      
      // Log error but don't throw - we don't want to fail the scan
      await entitlementsService.logBillingEvent(
        data.orgId,
        'usage_update_failed',
        {
          scan_id: data.scanId,
          error: (error as Error).message,
          pages_attempted: data.pageCount
        }
      );
    }
  }

  /**
   * Called when an individual page is crawled
   * Tracks page-level analytics
   */
  static async onPageCrawled(data: PageCrawlData): Promise<void> {
    try {
      // Track page crawl analytics
      trackPageCrawled(
        data.scanId,
        data.pageUrl,
        data.crawlDepth,
        data.duration,
        data.violationsFound,
        data.httpStatus
      );
      
    } catch (error) {
      console.error('Failed to track page crawl:', error);
      // Don't throw - this shouldn't block the crawl
    }
  }

  /**
   * Called when a scan fails
   * Adjusts usage if scan was counted but didn't complete
   */
  static async onScanFailed(scanId: string, orgId: string, reason: string): Promise<void> {
    try {
      // Log failure event
      await entitlementsService.logBillingEvent(
        orgId,
        'scan_failed',
        {
          scan_id: scanId,
          failure_reason: reason,
          timestamp: new Date().toISOString()
        }
      );

      // TODO: Consider if we should refund the scan count for failed scans
      // For now, we'll count failed scans toward usage to prevent abuse
      
      console.log(`❌ Scan ${scanId} failed for org ${orgId}: ${reason}`);
      
    } catch (error) {
      console.error('Failed to log scan failure:', error);
    }
  }

  /**
   * Get current usage statistics for an organization
   */
  static async getUsageStats(orgId: string): Promise<{
    currentPeriod: {
      scansUsed: number;
      pagesUsed: number;
      scansRemaining: number;
      usagePercent: number;
    };
    limits: {
      scansPerMonth: number;
      pagesPerScan: number;
    };
    tier: string;
  } | null> {
    try {
      const entitlements = await entitlementsService.getEntitlements(orgId);
      const usage = await entitlementsService.getUsage(orgId);

      if (!entitlements || !usage) {
        return null;
      }

      return {
        currentPeriod: {
          scansUsed: usage.scans_used,
          pagesUsed: usage.pages_used,
          scansRemaining: Math.max(0, entitlements.scans_per_month - usage.scans_used),
          usagePercent: Math.round((usage.scans_used / entitlements.scans_per_month) * 100)
        },
        limits: {
          scansPerMonth: entitlements.scans_per_month,
          pagesPerScan: entitlements.pages_per_scan
        },
        tier: entitlements.tier
      };
      
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return null;
    }
  }

  /**
   * Reset usage for a new billing period (called by billing webhooks)
   */
  static async resetUsageForNewPeriod(orgId: string): Promise<void> {
    try {
      await entitlementsService.resetUsage(orgId);
      
      await entitlementsService.logBillingEvent(
        orgId,
        'usage_period_reset',
        {
          reset_date: new Date().toISOString(),
          trigger: 'new_billing_period'
        }
      );

      console.log(`🔄 Usage reset for org ${orgId} - new billing period`);
      
    } catch (error) {
      console.error('Failed to reset usage for new period:', error);
      throw error; // This should be retried by the caller
    }
  }

  /**
   * Generate usage summary for billing/dashboard
   */
  static async generateUsageSummary(orgId: string, days: number = 30): Promise<{
    summary: {
      totalScans: number;
      totalPages: number;
      avgPagesPerScan: number;
      successRate: number;
    };
    trends: {
      scansThisPeriod: number;
      scansLastPeriod: number;
      growthPercent: number;
    };
    topDomains: Array<{
      domain: string;
      scanCount: number;
      lastScan: string;
    }>;
  } | null> {
    try {
      // Get billing events for the period
      const events = await entitlementsService.getBillingEvents(orgId, 100);
      
      const scanEvents = events.filter(e => e.event_type === 'scan_completed');
      const failedEvents = events.filter(e => e.event_type === 'scan_failed');
      
      const totalScans = scanEvents.length + failedEvents.length;
      const totalPages = scanEvents.reduce((sum, event) => {
        return sum + (event.event_data.pages_crawled || 0);
      }, 0);

      const avgPagesPerScan = totalScans > 0 ? Math.round(totalPages / scanEvents.length) : 0;
      const successRate = totalScans > 0 ? Math.round((scanEvents.length / totalScans) * 100) : 100;

      // Calculate trends (simplified - would need more complex date filtering in production)
      const midpoint = Math.floor(scanEvents.length / 2);
      const scansThisPeriod = scanEvents.slice(0, midpoint).length;
      const scansLastPeriod = scanEvents.slice(midpoint).length;
      const growthPercent = scansLastPeriod > 0 ? 
        Math.round(((scansThisPeriod - scansLastPeriod) / scansLastPeriod) * 100) : 0;

      // Get top domains
      const domainMap = new Map<string, { count: number; lastScan: string }>();
      scanEvents.forEach(event => {
        if (event.event_data.url) {
          try {
            const domain = new URL(event.event_data.url).hostname;
            const existing = domainMap.get(domain);
            domainMap.set(domain, {
              count: (existing?.count || 0) + 1,
              lastScan: event.created_at
            });
          } catch {
            // Invalid URL, skip
          }
        }
      });

      const topDomains = Array.from(domainMap.entries())
        .map(([domain, data]) => ({
          domain,
          scanCount: data.count,
          lastScan: data.lastScan
        }))
        .sort((a, b) => b.scanCount - a.scanCount)
        .slice(0, 5);

      return {
        summary: {
          totalScans,
          totalPages,
          avgPagesPerScan,
          successRate
        },
        trends: {
          scansThisPeriod,
          scansLastPeriod,
          growthPercent
        },
        topDomains
      };
      
    } catch (error) {
      console.error('Failed to generate usage summary:', error);
      return null;
    }
  }
}

// Convenience functions for worker/scanner integration
export const onScanComplete = UsageAccountant.onScanComplete;
export const onPageCrawled = UsageAccountant.onPageCrawled;
export const onScanFailed = UsageAccountant.onScanFailed;
export const getUsageStats = UsageAccountant.getUsageStats;