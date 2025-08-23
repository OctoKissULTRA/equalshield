import { NextRequest, NextResponse } from 'next/server';
import { env, isFeatureEnabled, isAIEnabled } from '@/lib/config/env';
import { createSupabaseClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/env
 * 
 * Admin-only endpoint to check environment configuration status
 * Shows feature flags and service connectivity without exposing secrets
 */
export async function GET(req: NextRequest) {
  try {
    // TODO: Add proper admin authentication here
    // For now, check for admin header or session
    const adminToken = req.headers.get('x-admin-token');
    if (adminToken !== process.env.ADMIN_TOKEN && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check database connectivity
    let dbConnected = false;
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.from('scans').select('id').limit(1);
      dbConnected = !error;
    } catch {
      dbConnected = false;
    }

    // Check Stripe configuration
    const stripeConfigured = !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
    const stripePricesConfigured = !!(env.STRIPE_PRICE_STARTER || env.STRIPE_PRICE_PRO);

    // Check AI configuration
    const aiConfigured = isAIEnabled() && !!env.OPENAI_API_KEY;

    // Check Redis configuration
    const redisConfigured = env.RATE_LIMIT_BACKEND === 'redis' 
      ? !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
      : 'memory';

    // Check cron configuration
    const cronConfigured = !!(env.TRUST_CRON_SECRET && env.SELF_SCAN_URL && env.SELF_SCAN_ORG_ID);

    // Check observability
    const sentryConfigured = !!env.SENTRY_DSN;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      
      services: {
        database: {
          configured: !!env.NEXT_PUBLIC_SUPABASE_URL,
          connected: dbConnected
        },
        stripe: {
          configured: stripeConfigured,
          prices: stripePricesConfigured,
          webhooks: !!env.STRIPE_WEBHOOK_SECRET
        },
        ai: {
          enabled: isAIEnabled(),
          configured: aiConfigured,
          provider: env.LLM_PROVIDER,
          model: env.LLM_MODEL
        },
        rateLimit: {
          backend: env.RATE_LIMIT_BACKEND,
          configured: redisConfigured
        },
        cron: {
          configured: cronConfigured,
          selfScan: !!env.SELF_SCAN_URL
        },
        observability: {
          sentry: sentryConfigured,
          environment: env.SENTRY_ENVIRONMENT
        }
      },
      
      features: {
        trial: isFeatureEnabled('trial'),
        share: isFeatureEnabled('share'),
        vpat: isFeatureEnabled('vpat'),
        watermark: isFeatureEnabled('watermark')
      },
      
      health: {
        allServicesConfigured: dbConnected && stripeConfigured && cronConfigured,
        criticalServicesUp: dbConnected && stripeConfigured,
        warnings: [
          !dbConnected && 'Database connection failed',
          !stripeConfigured && 'Stripe not fully configured',
          !stripePricesConfigured && 'Stripe prices not configured',
          !aiConfigured && isAIEnabled() && 'AI enabled but not configured',
          !sentryConfigured && 'Sentry error tracking not configured',
          redisConfigured === 'memory' && 'Using in-memory rate limiting'
        ].filter(Boolean)
      }
    });

  } catch (error) {
    console.error('Admin env check error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check environment status',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}