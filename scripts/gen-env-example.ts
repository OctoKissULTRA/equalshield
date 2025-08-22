#!/usr/bin/env npx tsx
/**
 * Generate .env.example from schema
 * 
 * Creates a clean template with all environment variables documented
 * Usage: npm run env:example
 */

import { writeFileSync } from "fs";
import * as path from "path";

const TEMPLATE = `# 🛡️ EqualShield Environment Configuration
# 
# Copy this file to .env.local for development
# For production, set these in your hosting provider's dashboard (Vercel, Railway, etc.)
# 
# 🔐 Security: Never commit .env.local or any file with real secrets to git
# 📚 Documentation: See lib/config/env.ts for validation rules

# ============================================================================
# CORE CONFIGURATION
# ============================================================================

# Environment mode (development | test | production)
NODE_ENV=development

# ============================================================================
# DATABASE
# ============================================================================

# Supabase Configuration (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key

# Alternative Postgres URL (optional if using Supabase)
DATABASE_URL=

# ============================================================================
# APPLICATION
# ============================================================================

# Public app URL (defaults to http://localhost:3000)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ============================================================================
# STRIPE BILLING
# ============================================================================

# Stripe API Keys (required)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (optional - can be set after creating products)
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# ============================================================================
# AI INSIGHTS (OPTIONAL)
# ============================================================================

# Enable AI summarization (true | false)
AI_SUMMARIZER_ENABLED=false

# LLM Provider (openai | anthropic | disabled)
LLM_PROVIDER=disabled

# OpenAI Configuration (required if AI_SUMMARIZER_ENABLED=true)
OPENAI_API_KEY=sk-...

# Model Configuration
LLM_MODEL=gpt-5-thinking
LLM_MAX_TOKENS=1200
LLM_TEMPERATURE=0.2
LLM_TIMEOUT_MS=20000

# Rate limits
AI_SUMMARY_PER_ORG_DAILY=50

# ============================================================================
# CRON & SELF-SCANNING
# ============================================================================

# Cron job authentication (required for /api/cron/* endpoints)
TRUST_CRON_SECRET=your-secure-random-string-min-32-chars
CRON_SECRET=

# Self-scan configuration (for /trust page)
SELF_SCAN_URL=https://equalshield.com
SELF_SCAN_ORG_ID=00000000-0000-0000-0000-000000000000

# ============================================================================
# RATE LIMITING (OPTIONAL)
# ============================================================================

# Backend type (memory | redis)
RATE_LIMIT_BACKEND=memory

# Redis configuration (required if RATE_LIMIT_BACKEND=redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# ============================================================================
# OBSERVABILITY (OPTIONAL)
# ============================================================================

# Sentry error tracking
SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_AUTH_TOKEN=

# ============================================================================
# WORKER CONFIGURATION
# ============================================================================

# Worker identification
WORKER_ID=

# Job processing
POLL_INTERVAL_MS=5000
MAX_RETRIES=3
SCAN_MAX_CONCURRENCY=10
SCAN_MAX_PAGES_OVERRIDE=

# ============================================================================
# BROWSER CACHE PATHS
# ============================================================================

# Cache directories for headless browsers (serverless/container safe defaults)
XDG_CACHE_HOME=/tmp/.cache
PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers
PUPPETEER_CACHE_DIR=/tmp/puppeteer

# ============================================================================
# FEATURE FLAGS
# ============================================================================

# Trial system (true | false)
FEATURE_TRIAL_ENABLED=true

# Share links (true | false)
FEATURE_SHARE_ENABLED=true

# Watermark trial reports (true | false)
FEATURES_WATERMARK_TRIAL=true

# VPAT export (true | false)
FEATURE_VPAT_EXPORT=true

# ============================================================================
# EMAIL (OPTIONAL)
# ============================================================================

# Resend API for transactional emails
RESEND_API_KEY=
EMAIL_FROM=noreply@equalshield.com

# ============================================================================
# SECURITY
# ============================================================================

# JWT secret for session tokens (min 32 chars)
JWT_SECRET=

# Session configuration
SESSION_COOKIE_NAME=equalshield_session

# CORS configuration (comma-separated origins)
ALLOWED_ORIGINS=

# Content Security Policy reporting
CSP_REPORT_URI=

# ============================================================================
# QUICK START
# ============================================================================
# 
# Minimum required for local development:
# 1. Copy this file to .env.local
# 2. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
# 3. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
# 4. Set TRUST_CRON_SECRET, SELF_SCAN_URL, SELF_SCAN_ORG_ID
# 5. Run: npm run env:check
# 
# For AI features, also set:
# - AI_SUMMARIZER_ENABLED=true
# - LLM_PROVIDER=openai
# - OPENAI_API_KEY=your-key
#
# ============================================================================
`;

const outputPath = path.join(process.cwd(), ".env.example");
writeFileSync(outputPath, TEMPLATE, "utf8");

console.log("✅ Generated .env.example");
console.log("\n📋 Next steps:");
console.log("  1. Copy .env.example to .env.local");
console.log("  2. Fill in your actual values");
console.log("  3. Run 'npm run env:check' to validate");
console.log("\n💡 Tip: Keep .env.example in git as documentation");
console.log("       Never commit .env.local or files with real secrets");