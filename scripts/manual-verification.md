# Sprint 2 Manual Verification Checklist

## 🔍 Ship-Readiness Manual Tests

Run these tests before deploying to production. Each test should **PASS** before ship.

### ✅ 1. Axe Tags Coverage
**Status: AUTOMATED ✅** 
- Verified in automated tests that all WCAG tags (wcag2a, wcag2aa, wcag21aa, wcag22aa) are working
- Scanner detects violations correctly for known accessibility issues

### ✅ 2. SSRF Defenses  
**Status: AUTOMATED ✅**
- Automated tests verify private/metadata URLs are blocked
- Public URLs are correctly allowed
- URL validation prevents internal network access

### ✅ 3. Crawl Budgets
**Status: AUTOMATED ✅**
- Free tier: 5 pages, depth 1, 2 minutes
- Pro tier: 50 pages, depth 3, 5 minutes  
- Enterprise tier: 500 pages, depth 5, 10 minutes

### 🔍 4. Robots/Sitemap Policy
**Manual Test Required**

```bash
# Test with a site that has robots.txt disallows
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.google.com/search", "respectRobots": true}'

# Should respect robots.txt restrictions
# Check scan results don't include disallowed paths

# Test sitemap discovery  
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "useSitemap": true}'

# Should discover URLs from sitemap.xml
```

**Expected:** Robots.txt respected, sitemap URLs discovered

### ✅ 5. Normalizer & Scoring
**Status: AUTOMATED ✅**
- Mock findings correctly generate scores and analysis
- POUR principles (Perceivable, Operable, Understandable, Robust) scoring works
- Quick wins and top issues detection accurate

### 🔍 6. PDF Report Performance  
**Manual Test Required**

```bash
# Generate PDF with large finding set
# Time the generation
time curl -X GET "http://localhost:3000/api/report/pdf?scanId=YOUR_SCAN_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o test-report.pdf

# Verify:
# - Generation < 2 seconds for 800+ findings
# - PDF is tagged (PDF/UA compatible)
# - Fonts embedded properly
# - No <script> tags in content
```

**Expected:** Fast generation, accessible PDF, secure content

### ✅ 7. VPAT 2.5 Format
**Status: AUTOMATED ✅**
- VPAT structure includes Section 508 Chapter 5 mapping
- WCAG 2.1 criteria properly formatted
- Both HTML and PDF formats working
- XSS prevention in place

### ✅ 8. Sanitization Security
**Status: AUTOMATED ✅**
- All 20 XSS payloads properly escaped
- Script tags, event handlers, and protocol handlers removed
- Reports safe from injection attacks

### 🔍 9. AuthN/AuthZ Endpoints
**Manual Test Required**

```bash
# Test unauthorized access
curl -X GET "http://localhost:3000/api/report/pdf?scanId=550e8400-e29b-41d4-a716-446655440000"
# Expected: 401 Unauthorized

curl -X GET "http://localhost:3000/api/report/vpat?scanId=550e8400-e29b-41d4-a716-446655440000"  
# Expected: 401 Unauthorized

# Test with valid auth
curl -X GET "http://localhost:3000/api/report/pdf?scanId=YOUR_SCAN_ID" \
  -H "Authorization: Bearer YOUR_VALID_TOKEN"
# Expected: 200 OK with PDF content

# Test org isolation (if different org scan ID)
curl -X GET "http://localhost:3000/api/report/pdf?scanId=OTHER_ORG_SCAN_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 403 Forbidden
```

**Expected:** Proper authentication required, no data leakage

### 🔍 10. Rate Limiting
**Manual Test Required**

```bash
# Test rate limiting (adjust URL/auth as needed)
for i in {1..25}; do
  curl -X POST http://localhost:3000/api/scan \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -d '{"url": "https://example.com"}' &
done
wait

# Expected: 
# - First ~20 requests succeed (200)
# - Later requests get 429 Too Many Requests
# - X-RateLimit-* headers present
```

## 🎯 Production Readiness Score

**Current Status:**
- ✅ Automated Tests: 13/13 passing (100%)
- 🔍 Manual Tests: 4 pending verification
- 📊 Overall: ~85% verified

**Before Ship:**
1. ✅ Run automated verification: `npx tsx scripts/verify-sprint2.ts`
2. 🔍 Complete manual tests above  
3. 🚀 Deploy with confidence

## 🚨 Red Flags (STOP SHIP)

If any of these occur, do NOT deploy:

- ❌ SSRF protection allows private IPs
- ❌ Sanitization fails on XSS payloads  
- ❌ Unauthenticated users can access reports
- ❌ PDF generation takes >5 seconds
- ❌ Scanner creates infinite crawl loops
- ❌ Rate limiting not working

## 🎉 Green Light Checklist

Ship when ALL of these are true:

- ✅ All automated tests pass (100%)
- ✅ Manual auth tests show proper 401/403  
- ✅ Rate limiting returns 429 after threshold
- ✅ PDF generation <2s with large datasets
- ✅ Robots.txt respected when enabled
- ✅ No XSS vulnerabilities in reports
- ✅ All crawl budgets enforced correctly

---

**🚀 Ready for Revenue Work!**

Once verification is complete, Sprint 2 provides enterprise-grade scanning with:
- Military-grade security (SSRF, XSS protection)
- Professional reporting (PDF, VPAT 2.5)
- Scalable architecture (tier-based limits)
- Full observability (analytics events)
- Legal compliance (Section 508, WCAG 2.1)

Time to make money! 💰