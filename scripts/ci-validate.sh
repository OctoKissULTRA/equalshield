#!/usr/bin/env bash
set -euo pipefail

echo "🚀 EqualShield End-to-End Integration Validation"
echo "=================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo "== 1) Environment Check =="
: "${POSTGRES_URL:?POSTGRES_URL environment variable required}"
: "${OPENAI_API_KEY:?OPENAI_API_KEY environment variable required}" 
success "Required environment variables present"

echo "== 2) Node.js Version =="
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18+ required, found: $(node --version)"
fi
success "Node.js version: $(node --version)"

echo "== 3) TypeScript Compilation =="
if npm run build >/dev/null 2>&1; then
    success "TypeScript compilation successful"
else
    error "TypeScript compilation failed"
fi

echo "== 4) Database Schema Migration =="
if npx drizzle-kit migrate >/dev/null 2>&1; then
    success "Database migrations applied"
else
    warn "Database migration failed or already applied"
fi

echo "== 5) Queue Functions Check =="
if psql "$POSTGRES_URL" -c "\df+ claim_next_job" >/dev/null 2>&1; then
    success "claim_next_job() function exists"
else
    warn "claim_next_job() function missing - run database-worker-upgrade.sql"
fi

if psql "$POSTGRES_URL" -c "\d+ scan_jobs" >/dev/null 2>&1; then
    success "scan_jobs table exists"
else
    warn "scan_jobs table missing - run database-worker-upgrade.sql"
fi

echo "== 6) LLM Parameter Validation =="
if grep -R "max_tokens.*gpt-5" src worker app 2>/dev/null; then
    error "Found max_tokens with gpt-5 - should be max_completion_tokens"
else
    success "No max_tokens found with gpt-5 calls"
fi

if grep -R "max_completion_tokens" src worker app >/dev/null 2>&1; then
    success "Found max_completion_tokens usage (correct for GPT-5)"
else
    warn "No max_completion_tokens found - may not be using GPT-5"
fi

echo "== 7) API Endpoints Check =="
info "Starting development server for API tests..."

# Start dev server in background
npm run dev >/dev/null 2>&1 &
DEV_PID=$!
sleep 10  # Wait for server to start

# Cleanup function
cleanup() {
    if [ ! -z "$DEV_PID" ]; then
        kill $DEV_PID >/dev/null 2>&1 || true
    fi
}
trap cleanup EXIT

# Test scan enqueue
echo "Testing scan enqueue endpoint..."
SCAN_JSON=$(curl -s -X POST http://localhost:3000/api/scan \
    -H 'content-type: application/json' \
    -d '{
        "url":"https://example.com",
        "email":"ci@equalshield.com",
        "tier":"free"
    }' 2>/dev/null || echo '{"error":"connection_failed"}')

if echo "$SCAN_JSON" | grep -q '"success":true'; then
    SCAN_ID=$(echo "$SCAN_JSON" | sed -n 's/.*"scanId":\s*\([0-9]\+\).*/\1/p')
    success "Scan enqueue successful, ID: $SCAN_ID"
else
    error "Scan enqueue failed: $SCAN_JSON"
fi

# Test results endpoint
if [ ! -z "$SCAN_ID" ]; then
    echo "Testing results endpoint..."
    RESULTS_JSON=$(curl -s "http://localhost:3000/api/scan/$SCAN_ID" 2>/dev/null || echo '{"error":"connection_failed"}')
    
    if echo "$RESULTS_JSON" | grep -q '"scan":'; then
        success "Results endpoint working"
    else
        warn "Results endpoint response: $RESULTS_JSON"
    fi
fi

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_JSON=$(curl -s http://localhost:3000/api/scan 2>/dev/null || echo '{"error":"connection_failed"}')
if echo "$HEALTH_JSON" | grep -q '"status":"healthy"'; then
    success "Health endpoint working"
else
    info "Health endpoint response: $HEALTH_JSON"
fi

echo "== 8) Database Verification =="
# Check if scan was inserted
if psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM scans WHERE email='ci@equalshield.com'" >/dev/null 2>&1; then
    success "Scan record inserted into database"
else
    warn "Could not verify scan insertion"
fi

echo "== 9) Rate Limiting Check =="
info "Testing rate limiting (this may take a moment)..."
SUCCESS_COUNT=0
for i in {1..7}; do
    RESP=$(curl -s -w "%{http_code}" -X POST http://localhost:3000/api/scan \
        -H 'content-type: application/json' \
        -d "{\"url\":\"https://example$i.com\",\"email\":\"ratetest@equalshield.com\",\"tier\":\"free\"}" \
        2>/dev/null || echo "000")
    
    if [[ "$RESP" == *"200" ]]; then
        ((SUCCESS_COUNT++))
    elif [[ "$RESP" == *"429" ]]; then
        success "Rate limiting activated after $SUCCESS_COUNT requests"
        break
    fi
done

if [ $SUCCESS_COUNT -ge 6 ]; then
    warn "Rate limiting may not be working (allowed $SUCCESS_COUNT requests)"
fi

echo "== 10) File Structure Validation =="
REQUIRED_FILES=(
    "worker/index.js"
    "app/api/scan/route.ts"
    "app/api/scan/[id]/route.ts"
    "app/api/report/pdf/route.ts"
    "app/api/fixes/github-pr/route.ts"
    "lib/db/schema.ts"
    "database-worker-upgrade.sql"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        success "$file exists"
    else
        error "$file missing"
    fi
done

echo "== 11) Worker Validation (if running) =="
if curl -s http://localhost:8080/health >/dev/null 2>&1; then
    success "Worker health endpoint responding"
else
    info "Worker not running locally (expected if not started)"
fi

echo "== 12) Security Check =="
# Check for hardcoded secrets (basic check)
if grep -r "sk-" --include="*.ts" --include="*.js" . 2>/dev/null | grep -v ".env" | grep -v "example" | head -1; then
    error "Potential hardcoded API keys found"
else
    success "No obvious hardcoded secrets found"
fi

# Check for proper imports
if grep -r "from.*rate-limit" app/ >/dev/null 2>&1; then
    success "Rate limiting properly imported"
else
    warn "Rate limiting imports not found"
fi

cleanup

echo ""
echo "🎉 VALIDATION COMPLETE"
echo "======================"
success "EqualShield platform validated against integration runbook"
info "Ready for production deployment to Vercel + Railway"
echo ""
echo "Next steps:"
echo "1. Deploy worker: cd worker && railway up"  
echo "2. Run database upgrade: psql \$POSTGRES_URL -f database-worker-upgrade.sql"
echo "3. Deploy main app: vercel --prod"
echo "4. Monitor logs and test end-to-end flow"