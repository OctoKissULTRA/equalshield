/**
 * Application Bootstrap
 * 
 * Validates environment configuration at startup
 * Ensures fail-fast behavior for misconfigured deployments
 */

import { env } from '@/lib/config/env';

let bootstrapped = false;

export function bootstrap(): void {
  if (bootstrapped) return;
  
  try {
    // Access env to trigger validation
    void env;
    
    // Validate critical dependencies
    validateDatabaseConnection();
    validateStripeConfiguration();
    validateCronConfiguration();
    
    // Log successful bootstrap
    console.log('✅ Application bootstrap successful');
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Features: Trial=${env.FEATURE_TRIAL_ENABLED}, Share=${env.FEATURE_SHARE_ENABLED}, AI=${env.AI_SUMMARIZER_ENABLED}`);
    
    bootstrapped = true;
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    
    // In production, fail fast
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    
    throw error;
  }
}

function validateDatabaseConnection(): void {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Database configuration missing');
  }
}

function validateStripeConfiguration(): void {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe configuration missing');
  }
  
  // Validate Stripe key format
  if (!env.STRIPE_SECRET_KEY.startsWith('sk_')) {
    throw new Error('Invalid Stripe secret key format');
  }
}

function validateCronConfiguration(): void {
  if (!env.TRUST_CRON_SECRET) {
    throw new Error('Cron authentication secret missing');
  }
  
  if (env.TRUST_CRON_SECRET.length < 32) {
    throw new Error('Cron secret must be at least 32 characters');
  }
  
  // Validate self-scan configuration
  if (!env.SELF_SCAN_URL || !env.SELF_SCAN_ORG_ID) {
    console.warn('⚠️  Self-scan configuration incomplete - /trust page will not work');
  }
}

// Auto-bootstrap on import in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  bootstrap();
}