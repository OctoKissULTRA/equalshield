# 📚 EqualShield Operations Runbook

## SLOs & Alerts

### Service Level Objectives
- **API Health**: 99.9% 2xx responses on `/api/scan` (per day)
- **Scan Success Rate**: ≥97% (excluding user input errors)
- **PDF Generation**: p95 ≤2.5s
- **Pager Trigger**: 15+ minutes of SLO breach

### Key Metrics Dashboard
```
- Scan throughput: scans/hour
- Worker utilization: active/total workers
- Queue depth: pending jobs
- Error rates: 4xx/5xx by endpoint
- Performance: p95 response times
```

## Kill Switches & Feature Flags

### Environment Variables (Immediate Effect)
```bash
# Disable trial system
FEATURE_TRIAL_ENABLED=false

# Disable share functionality  
FEATURE_SHARE_ENABLED=false

# Global worker capacity
SCAN_MAX_CONCURRENCY=10

# Emergency page limit override
SCAN_MAX_PAGES_OVERRIDE=20
```

### Database Kill Switches
```sql
-- Emergency: Disable all scanning
UPDATE org_entitlements SET scans_per_month = 0;

-- Emergency: Clear stuck job queue
UPDATE scan_jobs SET status = 'cancelled', cancel_requested = true 
WHERE status IN ('pending', 'processing') AND created_at < now() - interval '1 hour';
```

## Common Incidents & Actions

### 🔥 Stripe/Webhooks Down
**Symptoms**: Entitlements not updating, checkout completion fails
**Action**:
```bash
# Check webhook delivery in Stripe dashboard
# Manual entitlement bump (temporary)
UPDATE org_entitlements SET scans_per_month = scans_per_month + 100 
WHERE org_id = '<affected_org>';

# Re-deliver webhook events via Stripe CLI
stripe events resend <event_id>
```
**Grace Period**: System fails open for 24h for existing customers

### 🔥 Queue Jam
**Symptoms**: Scans stuck in "processing", no progress updates
**Action**:
```sql
-- Cancel stuck jobs
UPDATE scan_jobs SET cancel_requested = true 
WHERE status = 'processing' AND lease_expires_at < now() - interval '5 minutes';

-- Requeue failed jobs (if safe)
UPDATE scan_jobs SET status = 'pending', retry_count = retry_count + 1 
WHERE status = 'failed' AND retry_count < 3;
```
**Worker Action**: Restart worker pods/processes

### 🔥 Cron Secret Leak
**Symptoms**: Unauthorized cron job executions
**Action**:
1. Rotate `TRUST_CRON_SECRET` immediately
2. Redeploy application to invalidate old secret
3. Check logs for abuse: `grep "cron" logs | grep -v "200"`
4. Audit recent scan activity for anomalies

### 🔥 Bad Release
**Symptoms**: 5xx errors, broken functionality
**Action**: See Rollback section below

## Rollback Procedure

### 1. Immediate Rollback (Next.js + Vercel)
```bash
# Option A: Revert commit
git revert <bad_commit_hash>
git push origin main

# Option B: Promote previous deployment
# Via Vercel dashboard: Deployments → Previous → Promote

# Option C: Local build + deploy
git checkout <last_good_commit>
pnpm build
vercel --prod
```

### 2. Verification
```bash
# Health check endpoints
curl -s https://<app>/api/health | jq '.status'
curl -s -o /dev/null -w "%{http_code}\n" https://<app>/
curl -s -o /dev/null -w "%{http_code}\n" https://<app>/trial  
curl -s -o /dev/null -w "%{http_code}\n" https://<app>/trust

# Test share flow
curl -s -X POST https://<app>/api/reports/share \
  -H 'content-type: application/json' \
  -d '{"scanId":"<test_scan>", "ttlDays":1}' | jq '.success'
```

### 3. Communication
- Update status page
- Notify #alerts channel
- Customer comms if user-facing impact

## Data Retention & Cleanup

### Automated Cleanup (Daily/Weekly Crons)
- **Trials**: PII cleaned daily, analytics preserved
- **Share Tokens**: Expired tokens purged daily  
- **Scan Data**: Raw HTML purged at 30 days, findings kept
- **Worker Logs**: Rotated weekly, kept for 90 days

### Manual Data Operations
```sql
-- Delete organization data (GDPR/user request)
-- ⚠️  DESTRUCTIVE - Confirm org_id before running
BEGIN;
DELETE FROM scan_jobs WHERE org_id = '<org_id>';
DELETE FROM scans WHERE org_id = '<org_id>';
DELETE FROM share_tokens WHERE org_id = '<org_id>';
DELETE FROM org_entitlements WHERE org_id = '<org_id>';
-- Log action in audit trail
INSERT INTO audit_log (action, org_id, admin_id) VALUES ('data_deletion', '<org_id>', '<admin_id>');
COMMIT;
```

## Support Macros

### Common User Issues
**Trial Blocked**: 
> "Daily trial limit reached. Try again in 24 hours or upgrade for unlimited scans."

**Share Expired**:
> "This report link is no longer available. Ask the report owner to create a new share link."

**Scan Timeout**:
> "Scan exceeded time limit. Try scanning fewer pages or contact support for larger sites."

**Payment Failed**:
> "Subscription update failed. Please update your payment method in the billing section."

## Game-Day Chaos Drills

### Simulate Stripe Outage
```bash
# Block webhook route (simulate 5xx)
curl -X POST https://<app>/api/admin/feature-flags \
  -d '{"stripeWebhooks": false}'

# Run checkout; confirm 24h grace period activates
# Verify entitlements still work for existing customers
```

### Dead Worker Simulation  
```sql
-- Mark running job lease as expired
UPDATE scan_jobs SET lease_expires_at = now() - interval '1 minute' 
WHERE status = 'processing' LIMIT 1;

-- Verify another worker claims the job within 30s
```

### Emergency Scan Cancellation
```sql
-- Cancel specific scan
UPDATE scan_jobs SET cancel_requested = true 
WHERE scan_id = '<scan_id>';

-- Mass cancel (emergency load relief)
UPDATE scan_jobs SET cancel_requested = true 
WHERE status IN ('pending', 'processing') 
AND created_at > now() - interval '1 hour';
```

### Mass Share Revocation (Security Incident)
```sql
-- Revoke all shares for organization
UPDATE share_tokens SET revoked_at = now() 
WHERE org_id = '<org_id>';

-- Global emergency revocation
UPDATE share_tokens SET revoked_at = now() 
WHERE created_at > '<incident_time>';
```

## Post-Launch Dashboard Metrics

### Business Funnel
```
trial.started → trial.completed → signup → paid → first_download
```

### Technical Health
- **Throughput**: scans/hour, worker concurrency 
- **Performance**: p95 scan duration, PDF p95
- **Quality**: violations/page trend, top rules frequency
- **Abuse**: trial 429s, blocked SSRF attempts

### Monitoring Queries
```sql
-- Scan success rate (last 24h)
SELECT 
  COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / COUNT(*) as success_rate
FROM scans 
WHERE created_at > now() - interval '24 hours';

-- Average scan duration by tier
SELECT 
  e.tier,
  AVG(EXTRACT(epoch FROM (s.finished_at - s.created_at))) as avg_duration_seconds
FROM scans s
JOIN org_entitlements e ON s.org_id = e.org_id
WHERE s.finished_at IS NOT NULL
GROUP BY e.tier;

-- Trial conversion rate (last 7 days)
SELECT
  COUNT(*) FILTER (WHERE to.upgraded_at IS NOT NULL) * 100.0 / COUNT(*) as conversion_rate
FROM trial_orgs to
WHERE to.created_at > now() - interval '7 days';
```

## Emergency Contacts

- **On-Call Engineer**: [Slack: @oncall] [Phone: +1-XXX-XXX-XXXX]
- **Product Owner**: [Slack: @product] 
- **Infrastructure**: [Vercel Support] [Supabase Support]
- **Security**: [security@company.com]

## Quick Reference Commands

```bash
# Restart worker (if containerized)
kubectl rollout restart deployment/equalshield-worker

# Scale workers
kubectl scale deployment/equalshield-worker --replicas=5

# Check queue depth
psql -c "SELECT status, COUNT(*) FROM scan_jobs GROUP BY status;"

# Recent error logs
tail -f /var/log/equalshield.log | grep ERROR

# Performance check
curl -w "@curl-format.txt" -s -o /dev/null https://<app>/api/health
```