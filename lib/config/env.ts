/**
 * Environment Configuration Schema
 * 
 * Single source of truth for all environment variables
 * Type-safe validation at boot time with human-readable errors
 */

import { z } from "zod";

export const EnvSchema = z.object({
  // Core
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  DATABASE_URL: z.string().url({ message: "Must be a valid Postgres URL" }).optional(),
  
  // Supabase (primary database)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url({ message: "Must be a valid Supabase URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string({ required_error: "Supabase anon key required" }),
  SUPABASE_SERVICE_ROLE_KEY: z.string({ required_error: "Supabase service role key required" }),

  // App URLs
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),

  // Stripe
  STRIPE_SECRET_KEY: z.string({ required_error: "Stripe secret key required" }),
  STRIPE_WEBHOOK_SECRET: z.string({ required_error: "Stripe webhook secret required" }),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),

  // LLM / AI Insights
  AI_SUMMARIZER_ENABLED: z.enum(["true", "false"]).default("false"),
  LLM_PROVIDER: z.enum(["openai", "anthropic", "disabled"]).default("disabled"),
  OPENAI_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default("gpt-5-thinking"),
  LLM_MAX_TOKENS: z.coerce.number().default(1200),
  LLM_TEMPERATURE: z.coerce.number().min(0).max(1).default(0.2),
  LLM_TIMEOUT_MS: z.coerce.number().default(20000),
  AI_SUMMARY_PER_ORG_DAILY: z.coerce.number().default(50),

  // Cron & Trust
  TRUST_CRON_SECRET: z.string({ required_error: "Trust cron secret required for self-scanning" }),
  SELF_SCAN_URL: z.string().url({ message: "Must be a valid URL for self-scanning" }),
  SELF_SCAN_ORG_ID: z.string().uuid({ message: "Must be a valid UUID for self-scan organization" }),
  CRON_SECRET: z.string().optional(), // Legacy cron secret

  // Rate limiting (optional durable backend)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  RATE_LIMIT_BACKEND: z.enum(["memory", "redis"]).default("memory"),

  // Observability
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default("production"),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // Worker Configuration
  WORKER_ID: z.string().optional(),
  POLL_INTERVAL_MS: z.coerce.number().default(5000),
  MAX_RETRIES: z.coerce.number().default(3),
  SCAN_MAX_CONCURRENCY: z.coerce.number().default(10),
  SCAN_MAX_PAGES_OVERRIDE: z.coerce.number().optional(),

  // Headless runtime caches (safe defaults for serverless/containers)
  XDG_CACHE_HOME: z.string().default("/tmp/.cache"),
  PLAYWRIGHT_BROWSERS_PATH: z.string().default("/tmp/pw-browsers"),
  PUPPETEER_CACHE_DIR: z.string().default("/tmp/puppeteer"),

  // Feature flags
  FEATURE_TRIAL_ENABLED: z.enum(["true", "false"]).default("true"),
  FEATURE_SHARE_ENABLED: z.enum(["true", "false"]).default("true"),
  FEATURES_WATERMARK_TRIAL: z.enum(["true", "false"]).default("true"),
  FEATURE_VPAT_EXPORT: z.enum(["true", "false"]).default("true"),

  // Email (optional)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional().default("noreply@equalshield.com"),

  // Authentication
  JWT_SECRET: z.string().min(32).optional(),
  SESSION_COOKIE_NAME: z.string().default("equalshield_session"),
  
  // Security
  ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list
  CSP_REPORT_URI: z.string().url().optional(),
})
.superRefine((env, ctx) => {
  // If AI is enabled, enforce provider & API key
  if (env.AI_SUMMARIZER_ENABLED === "true") {
    if (env.LLM_PROVIDER === "openai" && !env.OPENAI_API_KEY) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: "OPENAI_API_KEY required when AI_SUMMARIZER_ENABLED=true", 
        path: ["OPENAI_API_KEY"] 
      });
    }
    if (env.LLM_PROVIDER === "disabled") {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: "LLM_PROVIDER cannot be 'disabled' when AI_SUMMARIZER_ENABLED=true", 
        path: ["LLM_PROVIDER"] 
      });
    }
  }

  // If Redis rate limiting is enabled, enforce Redis config
  if (env.RATE_LIMIT_BACKEND === "redis") {
    if (!env.UPSTASH_REDIS_REST_URL) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: "UPSTASH_REDIS_REST_URL required when RATE_LIMIT_BACKEND=redis", 
        path: ["UPSTASH_REDIS_REST_URL"] 
      });
    }
    if (!env.UPSTASH_REDIS_REST_TOKEN) {
      ctx.addIssue({ 
        code: z.ZodIssueCode.custom, 
        message: "UPSTASH_REDIS_REST_TOKEN required when RATE_LIMIT_BACKEND=redis", 
        path: ["UPSTASH_REDIS_REST_TOKEN"] 
      });
    }
  }

  // Validate Stripe price IDs format if provided
  const stripePricePattern = /^price_[a-zA-Z0-9]+$/;
  if (env.STRIPE_PRICE_STARTER && !stripePricePattern.test(env.STRIPE_PRICE_STARTER)) {
    ctx.addIssue({ 
      code: z.ZodIssueCode.custom, 
      message: "Invalid Stripe price ID format (should start with 'price_')", 
      path: ["STRIPE_PRICE_STARTER"] 
    });
  }
  if (env.STRIPE_PRICE_PRO && !stripePricePattern.test(env.STRIPE_PRICE_PRO)) {
    ctx.addIssue({ 
      code: z.ZodIssueCode.custom, 
      message: "Invalid Stripe price ID format (should start with 'price_')", 
      path: ["STRIPE_PRICE_PRO"] 
    });
  }
});

export type Env = z.infer<typeof EnvSchema>;

// Cached parsed environment
let cached: Env | null = null;

/**
 * Get validated environment configuration
 * Throws on first access if validation fails
 */
export function getEnv(): Env {
  if (cached) return cached;
  
  const parsed = EnvSchema.safeParse(process.env);
  
  if (!parsed.success) {
    const msg = parsed.error.issues.map(i => 
      `  ❌ ${i.path.join(".")}: ${i.message}`
    ).join("\n");
    
    console.error("🚨 Environment Validation Failed:\n");
    console.error(msg);
    console.error("\n💡 Run 'npm run env:check' to see all environment variables");
    
    throw new Error(`Environment validation failed:\n${msg}`);
  }
  
  cached = parsed.data;
  return cached;
}

/**
 * Type-safe environment variable access
 * Use this instead of process.env directly
 */
export const env = new Proxy({} as Env, {
  get: (_, prop: string) => {
    const config = getEnv();
    return config[prop as keyof Env];
  }
});

/**
 * Check if running in production
 */
export const isProduction = () => getEnv().NODE_ENV === "production";

/**
 * Check if running in development
 */
export const isDevelopment = () => getEnv().NODE_ENV === "development";

/**
 * Check if AI features are enabled
 */
export const isAIEnabled = () => getEnv().AI_SUMMARIZER_ENABLED === "true";

/**
 * Check if feature flag is enabled
 */
export function isFeatureEnabled(feature: "trial" | "share" | "vpat" | "watermark"): boolean {
  const env = getEnv();
  switch (feature) {
    case "trial": return env.FEATURE_TRIAL_ENABLED === "true";
    case "share": return env.FEATURE_SHARE_ENABLED === "true";
    case "vpat": return env.FEATURE_VPAT_EXPORT === "true";
    case "watermark": return env.FEATURES_WATERMARK_TRIAL === "true";
    default: return false;
  }
}