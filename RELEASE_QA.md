# 🧪 Release QA Checklist

## Lightweight QA for Every Release

### Pre-Deploy Checks
```bash
# ✅ Test Suite
npm test                    # Unit tests
npm run test:violations     # Playwright + axe-core  
npm run scanner:test        # WCAG compliance tests

# ✅ Lighthouse Accessibility (≥95%)
npx lighthouse https://<app>/ --quiet --chrome-flags="--headless" --output=json | jq '.categories.accessibility.score'
npx lighthouse https://<app>/trial --quiet --chrome-flags="--headless" --output=json | jq '.categories.accessibility.score'  
npx lighthouse https://<app>/trust --quiet --chrome-flags="--headless" --output=json | jq '.categories.accessibility.score'

# ✅ Type Check
npm run type-check

# ✅ Build Success
npm run build
```

### Post-Deploy Smoke Tests (5 minutes)
```bash
# ✅ Trial Flow
echo "Testing trial flow..."
TRIAL=$(curl -s -X POST https://<app>/api/trial/start \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}')
SCAN_ID=$(echo "$TRIAL" | jq -r .scanId)
echo "Trial scan started: $SCAN_ID"

# Wait for completion (60s max for trials)
sleep 65

# Check completion
curl -s https://<app>/api/progress/$SCAN_ID | grep -q "completed"
echo "✅ Trial scan completed under 60s"

# ✅ Paid Scan (Full Flow)
PAID_SCAN=$(curl -s -X POST https://<app>/api/scan \
  -H 'authorization: Bearer <user_token>' \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com"}')
PAID_ID=$(echo "$PAID_SCAN" | jq -r .scanId)
echo "Paid scan started: $PAID_ID"

# ✅ PDF Generation (Unwatermarked)
curl -s -o test-report.pdf https://<app>/api/reports/$PAID_ID/pdf
file test-report.pdf | grep -q "PDF"
echo "✅ PDF generated successfully"

# ✅ Share Link Flow
SHARE=$(curl -s -X POST https://<app>/api/reports/share \
  -H 'content-type: application/json' \
  -d '{"scanId":"'$PAID_ID'", "ttlDays":1}')
SHARE_URL=$(echo "$SHARE" | jq -r .url)
echo "Share link created: $SHARE_URL"

# Test access
curl -s -o /dev/null -w "%{http_code}" https://<app>$SHARE_URL | grep -q "200"
echo "✅ Share link accessible"

# Revoke
TOKEN_ID=$(echo "$SHARE" | jq -r .id)
curl -s -X POST https://<app>/api/reports/revoke \
  -H 'content-type: application/json' \
  -d '{"tokenId":"'$TOKEN_ID'"}'

# Verify 404
curl -s -o /dev/null -w "%{http_code}" https://<app>$SHARE_URL | grep -q "404"
echo "✅ Share link revoked successfully"

# ✅ Browser Console Check
echo "Open browser console and verify:"
echo "- No CSP violations on /"
echo "- No CSP violations on /trial"  
echo "- No CSP violations on /trust"
echo "- No JavaScript errors during trial flow"

# ✅ Sentry Trace Check
echo "Verify in Sentry dashboard:"
echo "- Recent trace shows: API → worker → report"
echo "- Trace tagged with scanId"
echo "- No new error spikes"
```

### Performance Verification
```bash
# ✅ API Response Times
curl -w "API Health: %{time_total}s\n" -s -o /dev/null https://<app>/api/health
curl -w "Trial Start: %{time_total}s\n" -s -o /dev/null -X POST https://<app>/api/trial/start \
  -H 'content-type: application/json' -d '{"url":"https://example.com"}'

# ✅ Page Load Times  
curl -w "Homepage: %{time_total}s\n" -s -o /dev/null https://<app>/
curl -w "Trust Page: %{time_total}s\n" -s -o /dev/null https://<app>/trust
curl -w "Trial Page: %{time_total}s\n" -s -o /dev/null https://<app>/trial

# Targets: All <1s for page loads, <0.5s for API
```

### Security Spot Check
```bash
# ✅ SSRF Still Blocked
curl -s -o /dev/null -w "%{http_code}" -X POST https://<app>/api/trial/start \
  -H 'content-type: application/json' -d '{"url":"http://localhost:3000"}' | grep -q "400"
echo "✅ SSRF protection active"

# ✅ Headers Present
curl -sI https://<app>/ | grep -q "X-Frame-Options: DENY"
curl -sI https://<app>/ | grep -q "Content-Security-Policy"
echo "✅ Security headers present"

# ✅ Rate Limiting Active
for i in {1..11}; do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://<app>/api/trial/start \
    -H 'content-type: application/json' -d '{"url":"https://example.com"}'
done
echo ""
echo "✅ Rate limiting enforced (expect 429 after ~10 requests)"
```

## Manual QA Checklist

### UI/UX Testing
- [ ] Homepage loads quickly, CTA buttons work
- [ ] Trial flow: form → progress → results → upgrade prompt
- [ ] Trust page: shows latest scan, sample link works
- [ ] Share link: creates, opens, shows watermark if trial
- [ ] Dashboard: live progress updates, metrics accurate
- [ ] Billing: upgrade flow, portal access

### Cross-Browser Testing
- [ ] Chrome: All features work
- [ ] Firefox: All features work  
- [ ] Safari: All features work
- [ ] Mobile: Responsive design, touch interactions

### Edge Cases
- [ ] Very slow website (timeout handling)
- [ ] Website with many violations (large report)
- [ ] Invalid URL (error handling)
- [ ] Expired share token (404 page)
- [ ] Payment failure (graceful degradation)

## Rollback Triggers

### Automatic Rollback If:
- Error rate >5% on critical endpoints for 10+ minutes
- Lighthouse accessibility score <90% on marketing pages
- Database connection failures
- Critical Sentry alerts (undefined is not a function, etc.)

### Manual Rollback If:
- User reports of broken functionality
- Silent data corruption detected
- Security vulnerability discovered
- Performance degradation >50%

## Post-Release Monitoring (First 2 Hours)

### Key Metrics to Watch
```bash
# Error rates
grep "ERROR" /var/log/app.log | wc -l

# Response times  
curl -w "%{time_total}" -s -o /dev/null https://<app>/api/health

# Queue depth
psql -c "SELECT COUNT(*) FROM scan_jobs WHERE status = 'pending';"

# Trial success rate
psql -c "
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) 
FROM scans 
WHERE is_trial = true AND created_at > now() - interval '2 hours';
"
```

### Alerts to Monitor
- Scan failure rate spike
- PDF generation errors
- Share token creation failures
- Stripe webhook processing errors
- Trial rate limit breaches

## Success Criteria

### ✅ Release is GO if:
- All automated tests pass
- Lighthouse scores ≥95% accessibility
- Manual smoke tests pass
- No critical Sentry errors
- Response times within SLA
- Trial→conversion funnel works end-to-end

### 🚨 ROLLBACK if:
- Error rate >5% for >10 minutes
- Critical functionality broken
- Security headers missing
- Database errors
- Payment processing fails