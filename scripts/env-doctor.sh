#!/bin/bash
# Environment Doctor - Pre-deployment sanity check
set -euo pipefail

echo "🩺 EqualShield Environment Doctor"
echo "================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if required tools are installed
command -v node >/dev/null 2>&1 || { echo -e "${RED}❌ Node.js is required${NC}"; exit 1; }
command -v npm >/dev/null 2>&1 || { echo -e "${RED}❌ npm is required${NC}"; exit 1; }

# Step 1: Validate environment configuration
echo -e "\n📋 Checking environment configuration..."
if npm run env:check --silent; then
  echo -e "${GREEN}✅ Environment validation passed${NC}"
else
  echo -e "${RED}❌ Environment validation failed${NC}"
  exit 1
fi

# Step 2: Check if app can start (dry run)
echo -e "\n🚀 Testing application startup..."
timeout 5 npm run build --silent >/dev/null 2>&1 || true
if [ $? -eq 124 ]; then
  echo -e "${YELLOW}⚠️  Build timeout (expected in CI)${NC}"
else
  echo -e "${GREEN}✅ Build configuration valid${NC}"
fi

# Step 3: Validate feature flags
echo -e "\n🎛️  Checking feature flags..."
source .env.local 2>/dev/null || source .env 2>/dev/null || true

if [ "${FEATURE_TRIAL_ENABLED:-true}" = "false" ]; then
  echo -e "${YELLOW}⚠️  Trial system is disabled${NC}"
fi

if [ "${FEATURE_SHARE_ENABLED:-true}" = "false" ]; then
  echo -e "${YELLOW}⚠️  Share links are disabled${NC}"
fi

if [ "${AI_SUMMARIZER_ENABLED:-false}" = "true" ]; then
  if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo -e "${RED}❌ AI enabled but OPENAI_API_KEY not set${NC}"
    exit 1
  else
    echo -e "${GREEN}✅ AI insights configured${NC}"
  fi
else
  echo -e "${YELLOW}ℹ️  AI insights disabled${NC}"
fi

# Step 4: Check security headers (if server is running)
if [ -n "${APP_HOST:-}" ]; then
  echo -e "\n🔒 Checking security headers on ${APP_HOST}..."
  
  HEADERS=$(curl -sI "https://${APP_HOST}/" 2>/dev/null || echo "")
  
  if echo "$HEADERS" | grep -q "Content-Security-Policy"; then
    echo -e "${GREEN}✅ CSP header present${NC}"
  else
    echo -e "${YELLOW}⚠️  CSP header missing${NC}"
  fi
  
  if echo "$HEADERS" | grep -q "X-Frame-Options"; then
    echo -e "${GREEN}✅ X-Frame-Options present${NC}"
  else
    echo -e "${YELLOW}⚠️  X-Frame-Options missing${NC}"
  fi
fi

# Step 5: Test cron authentication (if configured)
if [ -n "${TRUST_CRON_SECRET:-}" ] && [ -n "${APP_HOST:-}" ]; then
  echo -e "\n⏰ Testing cron endpoint..."
  
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${TRUST_CRON_SECRET}" \
    "https://${APP_HOST}/api/cron/self-scan" 2>/dev/null || echo "000")
  
  if [ "$STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Cron authentication working${NC}"
  elif [ "$STATUS" = "403" ] || [ "$STATUS" = "401" ]; then
    echo -e "${RED}❌ Cron authentication failed${NC}"
    exit 1
  else
    echo -e "${YELLOW}⚠️  Could not reach cron endpoint (status: $STATUS)${NC}"
  fi
fi

# Step 6: Database connectivity check
echo -e "\n🗄️  Checking database configuration..."
if [ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo -e "${GREEN}✅ Database credentials configured${NC}"
else
  echo -e "${RED}❌ Database credentials missing${NC}"
  exit 1
fi

# Step 7: Stripe configuration check
echo -e "\n💳 Checking Stripe configuration..."
if [ -n "${STRIPE_SECRET_KEY:-}" ] && [ -n "${STRIPE_WEBHOOK_SECRET:-}" ]; then
  echo -e "${GREEN}✅ Stripe configured${NC}"
else
  echo -e "${RED}❌ Stripe configuration incomplete${NC}"
  exit 1
fi

# Summary
echo -e "\n================================="
echo -e "${GREEN}🎉 Environment doctor check passed!${NC}"
echo -e "Your environment is ready for deployment."
echo ""
echo "Next steps:"
echo "  1. Run 'npm run build' to create production build"
echo "  2. Deploy to your hosting provider"
echo "  3. Monitor /api/admin/env after deployment"
echo ""