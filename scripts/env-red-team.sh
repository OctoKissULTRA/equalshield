#!/bin/bash
# Environment Red Team Tests - Break things to ensure they fail correctly

echo "🔴 Environment Red Team Tests"
echo "Testing that misconfigurations fail properly..."
echo "============================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0
TESTS=0

# Test 1: AI enabled without API key
echo -e "\n🧪 Test 1: AI enabled without API key"
TESTS=$((TESTS + 1))
AI_SUMMARIZER_ENABLED=true OPENAI_API_KEY= npm run env:check --silent 2>&1 | grep -q "OPENAI_API_KEY required"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Correctly fails when AI enabled without key${NC}"
else
  echo -e "${RED}❌ Should fail when AI enabled without key${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 2: Redis rate limiting without Redis config
echo -e "\n🧪 Test 2: Redis rate limiting without config"
TESTS=$((TESTS + 1))
RATE_LIMIT_BACKEND=redis UPSTASH_REDIS_REST_URL= npm run env:check --silent 2>&1 | grep -q "UPSTASH_REDIS_REST_URL required"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Correctly fails when Redis enabled without URL${NC}"
else
  echo -e "${RED}❌ Should fail when Redis enabled without URL${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 3: Invalid Stripe price format
echo -e "\n🧪 Test 3: Invalid Stripe price ID format"
TESTS=$((TESTS + 1))
STRIPE_PRICE_STARTER=invalid_price npm run env:check --silent 2>&1 | grep -q "Invalid Stripe price ID"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Correctly validates Stripe price format${NC}"
else
  echo -e "${RED}❌ Should validate Stripe price format${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 4: Invalid UUID for org ID
echo -e "\n🧪 Test 4: Invalid UUID format"
TESTS=$((TESTS + 1))
SELF_SCAN_ORG_ID=not-a-uuid npm run env:check --silent 2>&1 | grep -q "Must be a valid UUID"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Correctly validates UUID format${NC}"
else
  echo -e "${RED}❌ Should validate UUID format${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 5: Missing required Supabase config
echo -e "\n🧪 Test 5: Missing required database config"
TESTS=$((TESTS + 1))
NEXT_PUBLIC_SUPABASE_URL= npm run env:check --silent 2>&1 | grep -q "required"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Correctly requires database configuration${NC}"
else
  echo -e "${RED}❌ Should require database configuration${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 6: Invalid URL format
echo -e "\n🧪 Test 6: Invalid URL format"
TESTS=$((TESTS + 1))
SELF_SCAN_URL=not-a-url npm run env:check --silent 2>&1 | grep -q "Must be a valid URL"
if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Correctly validates URL format${NC}"
else
  echo -e "${RED}❌ Should validate URL format${NC}"
  FAILURES=$((FAILURES + 1))
fi

# Test 7: Cron secret too short
echo -e "\n🧪 Test 7: Cron secret length validation"
TESTS=$((TESTS + 1))
# Note: This test would need to be implemented in the schema
echo -e "${YELLOW}⚠️  Cron secret length validation not yet implemented${NC}"

# Test 8: Test cron endpoint without auth
if [ -n "${APP_HOST:-}" ]; then
  echo -e "\n🧪 Test 8: Cron endpoint without auth"
  TESTS=$((TESTS + 1))
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${APP_HOST}/api/cron/self-scan" 2>/dev/null)
  if [ "$STATUS" = "401" ] || [ "$STATUS" = "403" ]; then
    echo -e "${GREEN}✅ Cron endpoint correctly requires auth (${STATUS})${NC}"
  else
    echo -e "${RED}❌ Cron endpoint should require auth (got ${STATUS})${NC}"
    FAILURES=$((FAILURES + 1))
  fi
fi

# Test 9: Test admin endpoint without auth
if [ -n "${APP_HOST:-}" ]; then
  echo -e "\n🧪 Test 9: Admin endpoint without auth"
  TESTS=$((TESTS + 1))
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${APP_HOST}/api/admin/env" 2>/dev/null)
  if [ "$STATUS" = "403" ]; then
    echo -e "${GREEN}✅ Admin endpoint correctly requires auth${NC}"
  else
    echo -e "${RED}❌ Admin endpoint should require auth (got ${STATUS})${NC}"
    FAILURES=$((FAILURES + 1))
  fi
fi

# Summary
echo -e "\n============================================="
echo -e "Red Team Results: $((TESTS - FAILURES))/$TESTS tests passed"

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}🎉 All red team tests passed!${NC}"
  echo "Your environment validation is working correctly."
  exit 0
else
  echo -e "${RED}⚠️  $FAILURES test(s) failed${NC}"
  echo "Review the failures above and fix validation logic."
  exit 1
fi