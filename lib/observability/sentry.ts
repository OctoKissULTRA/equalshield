// Minimal Sentry setup for error tracking
import * as Sentry from '@sentry/nextjs';

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Filter out health check and status polling noise
    beforeSend(event) {
      // Skip health check errors
      if (event.request?.url?.includes('/health') || 
          event.request?.url?.includes('/api/scan/job/')) {
        return null;
      }
      
      // Skip common client-side errors
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver')) {
        return null;
      }
      
      return event;
    },
    
    // Custom tags for filtering
    initialScope: {
      tags: {
        component: 'equalshield-web'
      }
    }
  });
  
  console.log('📊 Sentry error tracking initialized');
} else {
  console.log('📊 Sentry DSN not configured, skipping error tracking');
}

export default Sentry;