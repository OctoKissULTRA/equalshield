/**
 * Real-time Progress & Status Updates
 * 
 * Provides live scan progress updates and system metrics
 */

export interface ScanProgress {
  scanId: string;
  status: 'queued' | 'starting' | 'crawling' | 'analyzing' | 'generating_report' | 'completed' | 'failed';
  progress: number; // 0-100
  currentStep: string;
  startTime: string;
  estimatedCompletion?: string;
  pagesDiscovered: number;
  pagesCrawled: number;
  currentPage?: string;
  errors: Array<{
    page: string;
    error: string;
    timestamp: string;
  }>;
  metadata?: {
    totalViolations?: number;
    criticalIssues?: number;
    quickWins?: number;
    overallScore?: number;
  };
}

export interface LiveMetrics {
  timestamp: string;
  activeScans: number;
  queuedScans: number;
  completedToday: number;
  avgScanTime: number;
  systemHealth: {
    status: 'healthy' | 'degraded' | 'down';
    responseTime: number;
    errorRate: number;
  };
  usage: {
    scansThisHour: number;
    pagesThisHour: number;
    trendsData: Array<{
      time: string;
      scans: number;
      pages: number;
    }>;
  };
}

export class ProgressTracker {
  private static instance: ProgressTracker;
  private scanProgress = new Map<string, ScanProgress>();
  private subscribers = new Map<string, Set<(progress: ScanProgress) => void>>();
  private metricsSubscribers = new Set<(metrics: LiveMetrics) => void>();
  
  static getInstance(): ProgressTracker {
    if (!ProgressTracker.instance) {
      ProgressTracker.instance = new ProgressTracker();
    }
    return ProgressTracker.instance;
  }

  /**
   * Initialize a new scan in the progress tracker
   */
  initializeScan(scanId: string, url: string, estimatedPages: number = 5): void {
    const progress: ScanProgress = {
      scanId,
      status: 'queued',
      progress: 0,
      currentStep: 'Scan queued for processing',
      startTime: new Date().toISOString(),
      pagesDiscovered: 0,
      pagesCrawled: 0,
      errors: []
    };

    this.scanProgress.set(scanId, progress);
    this.notifySubscribers(scanId, progress);
  }

  /**
   * Update scan status and progress
   */
  updateScanProgress(
    scanId: string, 
    update: Partial<ScanProgress>
  ): void {
    const current = this.scanProgress.get(scanId);
    if (!current) {
      console.warn(`Scan ${scanId} not found in progress tracker`);
      return;
    }

    const updated: ScanProgress = {
      ...current,
      ...update,
      // Auto-calculate progress based on status if not provided
      progress: update.progress ?? this.calculateProgress(update.status || current.status, current)
    };

    // Update estimated completion
    if (updated.status === 'crawling' && updated.pagesDiscovered > 0) {
      const avgPageTime = this.estimatePageTime(updated.pagesDiscovered);
      const remainingPages = updated.pagesDiscovered - updated.pagesCrawled;
      const estimatedMs = remainingPages * avgPageTime;
      updated.estimatedCompletion = new Date(Date.now() + estimatedMs).toISOString();
    }

    this.scanProgress.set(scanId, updated);
    this.notifySubscribers(scanId, updated);
  }

  /**
   * Mark a page as crawled
   */
  onPageCrawled(
    scanId: string, 
    pageUrl: string, 
    violations?: number,
    error?: string
  ): void {
    const current = this.scanProgress.get(scanId);
    if (!current) return;

    const updates: Partial<ScanProgress> = {
      pagesCrawled: current.pagesCrawled + 1,
      currentPage: pageUrl,
      currentStep: `Analyzing ${pageUrl}`
    };

    // Add error if page failed
    if (error) {
      updates.errors = [
        ...current.errors,
        {
          page: pageUrl,
          error,
          timestamp: new Date().toISOString()
        }
      ];
    }

    // Update metadata if violations provided
    if (violations !== undefined && current.metadata) {
      updates.metadata = {
        ...current.metadata,
        totalViolations: (current.metadata.totalViolations || 0) + violations
      };
    }

    this.updateScanProgress(scanId, updates);
  }

  /**
   * Complete a scan with final results
   */
  completeScan(
    scanId: string,
    results: {
      overallScore: number;
      totalViolations: number;
      criticalIssues: number;
      quickWins: number;
    }
  ): void {
    this.updateScanProgress(scanId, {
      status: 'completed',
      progress: 100,
      currentStep: 'Scan completed successfully',
      metadata: {
        ...results
      }
    });

    // Clean up after 5 minutes
    setTimeout(() => {
      this.scanProgress.delete(scanId);
      this.subscribers.delete(scanId);
    }, 5 * 60 * 1000);
  }

  /**
   * Mark a scan as failed
   */
  failScan(scanId: string, error: string): void {
    this.updateScanProgress(scanId, {
      status: 'failed',
      currentStep: `Scan failed: ${error}`,
      errors: [
        ...(this.scanProgress.get(scanId)?.errors || []),
        {
          page: 'system',
          error,
          timestamp: new Date().toISOString()
        }
      ]
    });
  }

  /**
   * Subscribe to scan progress updates
   */
  subscribeScan(scanId: string, callback: (progress: ScanProgress) => void): () => void {
    if (!this.subscribers.has(scanId)) {
      this.subscribers.set(scanId, new Set());
    }
    
    this.subscribers.get(scanId)!.add(callback);

    // Send current progress immediately
    const current = this.scanProgress.get(scanId);
    if (current) {
      callback(current);
    }

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(scanId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(scanId);
        }
      }
    };
  }

  /**
   * Subscribe to live metrics updates
   */
  subscribeMetrics(callback: (metrics: LiveMetrics) => void): () => void {
    this.metricsSubscribers.add(callback);

    // Send current metrics immediately
    this.generateLiveMetrics().then(callback);

    return () => {
      this.metricsSubscribers.delete(callback);
    };
  }

  /**
   * Get current scan progress
   */
  getScanProgress(scanId: string): ScanProgress | null {
    return this.scanProgress.get(scanId) || null;
  }

  /**
   * Get all active scans
   */
  getActiveScans(): ScanProgress[] {
    return Array.from(this.scanProgress.values())
      .filter(scan => !['completed', 'failed'].includes(scan.status));
  }

  private calculateProgress(status: ScanProgress['status'], current: ScanProgress): number {
    switch (status) {
      case 'queued': return 0;
      case 'starting': return 5;
      case 'crawling': 
        if (current.pagesDiscovered > 0) {
          return Math.min(80, 20 + (current.pagesCrawled / current.pagesDiscovered) * 60);
        }
        return 20;
      case 'analyzing': return 85;
      case 'generating_report': return 95;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return current.progress;
    }
  }

  private estimatePageTime(pageCount: number): number {
    // Estimate time per page based on complexity
    // Quick scans: ~3s per page
    // Deep scans: ~8s per page
    return pageCount <= 5 ? 3000 : 8000;
  }

  private notifySubscribers(scanId: string, progress: ScanProgress): void {
    const subscribers = this.subscribers.get(scanId);
    if (subscribers) {
      subscribers.forEach(callback => callback(progress));
    }
  }

  private async generateLiveMetrics(): Promise<LiveMetrics> {
    const now = new Date();
    const activeScans = this.getActiveScans();
    
    // TODO: Connect to actual database for real metrics
    // For now, generate based on current progress data
    
    const completedToday = Array.from(this.scanProgress.values())
      .filter(scan => {
        const scanDate = new Date(scan.startTime);
        return scan.status === 'completed' && 
               scanDate.toDateString() === now.toDateString();
      }).length;

    // Generate trend data for last 24 hours
    const trendsData = Array.from({ length: 24 }, (_, i) => {
      const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
      return {
        time: time.toISOString(),
        scans: Math.floor(Math.random() * 10), // TODO: Replace with real data
        pages: Math.floor(Math.random() * 50)
      };
    });

    return {
      timestamp: now.toISOString(),
      activeScans: activeScans.length,
      queuedScans: activeScans.filter(s => s.status === 'queued').length,
      completedToday,
      avgScanTime: 45000, // TODO: Calculate from real data
      systemHealth: {
        status: 'healthy',
        responseTime: 150,
        errorRate: 0.02
      },
      usage: {
        scansThisHour: Math.floor(Math.random() * 20),
        pagesThisHour: Math.floor(Math.random() * 200),
        trendsData
      }
    };
  }

  /**
   * Broadcast metrics to all subscribers (called periodically)
   */
  async broadcastMetrics(): Promise<void> {
    if (this.metricsSubscribers.size > 0) {
      const metrics = await this.generateLiveMetrics();
      this.metricsSubscribers.forEach(callback => callback(metrics));
    }
  }
}

// Singleton instance
export const progressTracker = ProgressTracker.getInstance();

// Convenience functions
export const initializeScan = progressTracker.initializeScan.bind(progressTracker);
export const updateScanProgress = progressTracker.updateScanProgress.bind(progressTracker);
export const onPageCrawled = progressTracker.onPageCrawled.bind(progressTracker);
export const completeScan = progressTracker.completeScan.bind(progressTracker);
export const failScan = progressTracker.failScan.bind(progressTracker);
export const subscribeScan = progressTracker.subscribeScan.bind(progressTracker);
export const subscribeMetrics = progressTracker.subscribeMetrics.bind(progressTracker);

// Start metrics broadcasting (every 5 seconds)
if (typeof window === 'undefined') { // Server-side only
  setInterval(() => {
    progressTracker.broadcastMetrics();
  }, 5000);
}