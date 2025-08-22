'use client';

import { useEffect } from 'react';
import { trackTrustViewed, trackTrustSampleClicked, trackTrustPdfDownloaded } from '@/lib/analytics/trust-events';

interface TrustAnalyticsProps {
  latestScanId?: string;
  latestScanScore?: number;
  hasSampleLink: boolean;
}

export default function TrustAnalytics({
  latestScanId,
  latestScanScore,
  hasSampleLink
}: TrustAnalyticsProps) {
  useEffect(() => {
    // Track page view
    const userAgent = navigator.userAgent;
    const referrer = document.referrer;
    
    trackTrustViewed(
      latestScanId,
      latestScanScore,
      hasSampleLink,
      userAgent,
      referrer
    );

    // Set up click tracking for sample links
    const handleSampleClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const link = target.closest('a');
      
      if (!link || !latestScanId || !latestScanScore) return;
      
      const href = link.getAttribute('href');
      if (!href) return;
      
      // Track sample report clicks
      if (href.startsWith('/r/')) {
        trackTrustSampleClicked(
          latestScanId,
          href,
          latestScanScore,
          'view_sample'
        );
      }
      
      // Track PDF download clicks
      if (href.includes('/pdf')) {
        trackTrustPdfDownloaded(
          latestScanId,
          latestScanScore,
          'trust_page'
        );
      }
    };

    // Add click listeners to the document
    document.addEventListener('click', handleSampleClick);
    
    // Cleanup
    return () => {
      document.removeEventListener('click', handleSampleClick);
    };
  }, [latestScanId, latestScanScore, hasSampleLink]);

  // This component renders nothing visible
  return null;
}