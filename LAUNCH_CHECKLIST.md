# 🚀 EqualShield Launch Checklist

## Final Pre-Launch Spot Checks (10 minutes)

### Infra & Secrets
```bash
# ✅ Check environment variables
echo "TRUST_CRON_SECRET: ${TRUST_CRON_SECRET:+SET}"
echo "SELF_SCAN_URL: ${SELF_SCAN_URL:+SET}" 
echo "SELF_SCAN_ORG_ID: ${SELF_SCAN_ORG_ID:+SET}"
echo "STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:+SET}"
echo "STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:+SET}"

# ✅ Test cron endpoints
curl -s -H "Authorization: Bearer $TRUST_CRON_SECRET" https://<app>/api/cron/self-scan | jq '.success, .scanId'
curl -s -H "Authorization: Bearer $TRUST_CRON_SECRET" https://<app>/api/cron/publish-sample | jq '.success, .shareUrl'

# ✅ Database snapshot
# Note snapshot ID: ________________
```

### Security
```bash
# ✅ SSRF Protection Test
for URL in 'http://localhost:3000' 'http://127.0.0.1' 'http://169.254.169.254' 'http://10.0.0.1' 'http://foo.internal'; do
  echo "Testing: $URL"
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<app>/api/trial/start \
    -H 'content-type: application/json' -d "{\"url\":\"$URL\"}"
done
# Expect: all return 400

# ✅ XSS Test (create report with payload, check escaping)
curl -s -X POST https://<app>/api/reports/share \
  -H 'content-type: application/json' \
  -d '{"scanId":"<SCAN>", "note":"<script>alert(1)</script><img src=x onerror=alert(1)>"}' | jq .
# Then check shared page shows escaped content

# ✅ Security Headers
curl -sI https://<app>/ | grep -E 'Content-Security-Policy|X-Frame-Options|Referrer-Policy|Permissions-Policy'
curl -sI https://<app>/trust | grep -E 'Content-Security-Policy|X-Frame-Options|Referrer-Policy|Permissions-Policy'
# Expect: CSP default-src 'self', XFO DENY, Referrer-Policy strict-origin-when-cross-origin
```

### Product
```bash
# ✅ Full Trial Flow
TRIAL=$(curl -s -X POST https://<app>/api/trial/start -H 'content-type: application/json' -d '{"url":"https://example.com"}')
echo "$TRIAL" | jq '.success, .scanId'
SCAN_ID=$(echo "$TRIAL" | jq -r .scanId)

# Watch progress (first 20 lines)
curl -N https://<app>/api/progress/$SCAN_ID | sed -n '1,20p'

# ✅ Share Lifecycle
CREATE=$(curl -s -X POST https://<app>/api/reports/share -H 'content-type: application/json' -d '{"scanId":"'$SCAN_ID'", "ttlDays":7}')
SHARE_URL=$(echo "$CREATE" | jq -r .url)
echo "Share URL: $SHARE_URL"

# Test access
curl -s -I https://<app>$SHARE_URL | head -n 3

# Revoke
TOKEN_ID=$(echo "$CREATE" | jq -r .id)
curl -s -X POST https://<app>/api/reports/revoke -H 'content-type: application/json' -d '{"tokenId":"'$TOKEN_ID'"}'

# Verify 404
curl -s -o /dev/null -w "%{http_code}\n" https://<app>$SHARE_URL

# ✅ Trust Page
curl -s -o /dev/null -w "Trust page: %{time_total}s (%{http_code})\n" https://<app>/trust
```

### Observability
```bash
# ✅ Sentry Test Events
# From app: trigger test event with scanId tag
# From worker: trigger test event with scanId tag
# Check Sentry dashboard for linked traces

# ✅ Alerts Configuration
# Verify active:
# - report.pdf p95 > 2.5s (15min breach = page)
# - scan failure rate > 3%/h (15min breach = page)
```

## ✅ PASS/FAIL Summary
- [ ] All environment variables set
- [ ] Cron endpoints return 200 + valid JSON
- [ ] Database snapshot taken (ID: _________)
- [ ] SSRF protection blocks all test URLs (400)
- [ ] XSS payloads escaped in shared reports
- [ ] Security headers present on / and /trust
- [ ] Trial flow: start → progress → preview → upgrade
- [ ] Share flow: create → access → revoke → 404
- [ ] Trust page loads <1s with sample link
- [ ] Sentry receiving events with scanId tags
- [ ] Alerts configured and active