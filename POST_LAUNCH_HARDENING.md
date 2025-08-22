# 🔧 Post-Launch Hardening Tasks

## High-ROI Quick Wins (2-4 Hours Each)

### 1. Durable Rate Limiting (Redis/Upstash)

**Current**: In-memory rate limiting (resets on restart)
**Target**: Persistent rate limiting with Redis

**Implementation**:
```typescript
// lib/rate-limit-redis.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
})

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 24 * 60 * 60 * 1000
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const now = Date.now()
  const window = Math.floor(now / windowMs)
  const redisKey = `rate_limit:${key}:${window}`
  
  const current = await redis.incr(redisKey)
  
  if (current === 1) {
    // First request in window, set expiration
    await redis.expire(redisKey, Math.ceil(windowMs / 1000))
  }
  
  const resetTime = (window + 1) * windowMs
  
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
    resetTime
  }
}
```

**Migration Strategy**:
1. Add Upstash Redis to project
2. Create `lib/rate-limit-redis.ts` (above)
3. Update imports in `lib/trial.ts`: `checkTrialRateLimit` 
4. Deploy with feature flag: `RATE_LIMIT_BACKEND=redis`
5. Monitor for 24h, then remove in-memory fallback

**Environment Variables**:
```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
RATE_LIMIT_BACKEND=redis  # 'memory' for fallback
```

### 2. Scan Diff Tracking ("Progress Demo")

**Current**: Static scan results
**Target**: "3 new issues fixed since last scan" on report header

**Database Schema**:
```sql
-- Add to existing scans table
ALTER TABLE scans ADD COLUMN previous_scan_id UUID REFERENCES scans(id);
ALTER TABLE scans ADD COLUMN issues_delta JSONB; -- {added: 5, fixed: 3, changed: 1}

-- Index for domain+org lookup
CREATE INDEX idx_scans_domain_org_completed ON scans(domain, org_id, finished_at) 
WHERE status = 'completed';
```

**Implementation**:
```typescript
// lib/scan-diff.ts
export interface ScanDelta {
  added: number;
  fixed: number; 
  changed: number;
  summary: string; // "3 issues fixed, 2 new issues found"
}

export async function calculateScanDiff(
  currentScan: ScanResult,
  previousScan: ScanResult | null
): Promise<ScanDelta> {
  if (!previousScan) {
    return {
      added: currentScan.violations.length,
      fixed: 0,
      changed: 0,
      summary: `${currentScan.violations.length} issues found (first scan)`
    };
  }
  
  const prevViolations = new Set(previousScan.violations.map(v => v.fingerprint));
  const currViolations = new Set(currentScan.violations.map(v => v.fingerprint));
  
  const added = currentScan.violations.filter(v => !prevViolations.has(v.fingerprint)).length;
  const fixed = previousScan.violations.filter(v => !currViolations.has(v.fingerprint)).length;
  
  let summary = '';
  if (fixed > 0 && added === 0) summary = `🎉 ${fixed} issues fixed!`;
  else if (fixed > 0) summary = `${fixed} fixed, ${added} new issues`;
  else if (added > 0) summary = `${added} new issues found`;
  else summary = 'No changes since last scan';
  
  return { added, fixed, changed: 0, summary };
}

export async function findPreviousScan(domain: string, orgId: string): Promise<ScanResult | null> {
  const supabase = createSupabaseClient();
  
  const { data } = await supabase
    .from('scans')
    .select('*')
    .eq('domain', domain)
    .eq('org_id', orgId)
    .eq('status', 'completed')
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(2); // Current + previous
    
  return data?.[1] || null; // Second most recent
}
```

**Integration Points**:
1. **Scan Completion**: Calculate diff and store in `issues_delta`
2. **Report Header**: Show diff summary prominently
3. **Dashboard**: Add "Progress" tile with trends
4. **Share Pages**: Include diff in public reports

**UI Component**:
```tsx
// components/ScanDeltaBadge.tsx
export function ScanDeltaBadge({ delta }: { delta: ScanDelta }) {
  if (delta.fixed > 0) {
    return (
      <Badge variant="success" className="ml-2">
        <TrendingUp className="h-3 w-3 mr-1" />
        {delta.summary}
      </Badge>
    );
  }
  
  if (delta.added > 0) {
    return (
      <Badge variant="warning" className="ml-2">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {delta.summary}
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="ml-2">
      <Check className="h-3 w-3 mr-1" />
      {delta.summary}
    </Badge>
  );
}
```

## Medium-Term Improvements (1-2 Weeks Each)

### 3. Smart Retry & Dead Letter Queue

**Current**: Simple retry counter
**Target**: Exponential backoff + manual requeue UI

**Implementation**:
```sql
CREATE TABLE dead_letter_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_job_id UUID NOT NULL,
  scan_id UUID NOT NULL,
  org_id VARCHAR(255) NOT NULL,
  failure_reason TEXT NOT NULL,
  retry_count INTEGER NOT NULL,
  original_payload JSONB NOT NULL,
  failed_at TIMESTAMPTZ DEFAULT NOW(),
  requeued_at TIMESTAMPTZ,
  admin_notes TEXT
);
```

### 4. Real-Time Collaboration

**Target**: Live scan sharing with team members

**Features**:
- Real-time scan progress for team members
- Comment threads on violations
- Assignment of fixes to developers
- Integration with GitHub/Jira for issue creation

### 5. Enhanced Analytics & Insights

**Target**: Actionable accessibility insights

**Features**:
- Accessibility score trends over time
- Most common violation patterns
- "Quick wins" recommendations based on impact/effort
- Industry benchmarking (anonymized)

## Infrastructure Scaling (As Needed)

### 6. Multi-Region Deployment

**Current**: Single region (US)
**Target**: US + EU regions for GDPR compliance

**Components**:
- Regional worker clusters
- Data residency compliance
- Cross-region failover

### 7. Advanced Caching

**Current**: Minimal caching
**Target**: Smart caching strategy

**Layers**:
- CDN for static assets (images, CSS)
- Redis for scan results (24h TTL)
- Edge caching for public reports
- Database query caching

## Security Hardening

### 8. Enhanced CSP & Security Headers

**Current**: Basic CSP
**Target**: Strict CSP with nonce-based inline scripts

```typescript
// middleware.ts - Enhanced CSP
const nonce = generateNonce();
const csp = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'", // Tailwind requires this
  "img-src 'self' data: https:",
  "connect-src 'self' https://api.stripe.com",
  "frame-src https://js.stripe.com",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');
```

### 9. API Rate Limiting & DDoS Protection

**Current**: Basic rate limiting
**Target**: Sophisticated protection

**Features**:
- Per-endpoint rate limits
- Burst protection
- IP reputation scoring
- Geographic blocking for suspicious regions

## Compliance & Legal

### 10. GDPR Compliance Enhancement

**Current**: Basic data handling
**Target**: Full GDPR compliance

**Features**:
- Data export functionality
- Automated data deletion
- Consent management
- Data processing agreements

### 11. SOC 2 Preparation

**Target**: SOC 2 Type II compliance

**Components**:
- Access logging and monitoring
- Encryption at rest and in transit
- Security incident response procedures
- Regular security assessments

## Performance Optimization

### 12. Database Optimization

**Current**: Basic indexing
**Target**: Optimized for scale

**Improvements**:
- Query performance analysis
- Advanced indexing strategies
- Connection pooling optimization
- Read replicas for analytics

### 13. Worker Performance

**Current**: Single-threaded workers
**Target**: Optimized processing

**Improvements**:
- Parallel page processing
- Smart resource allocation
- Worker health monitoring
- Auto-scaling based on queue depth

## Monitoring & Observability

### 14. Advanced Monitoring

**Current**: Basic Sentry + logs
**Target**: Comprehensive observability

**Stack**:
- Distributed tracing (OpenTelemetry)
- Custom metrics dashboard
- Real-time alerting
- Performance profiling

### 15. Business Intelligence

**Target**: Data-driven product decisions

**Features**:
- Customer journey analytics
- Feature usage tracking
- A/B testing framework
- Churn prediction models

## Estimated Timeline & Priorities

### Week 1-2 (Launch Hardening)
1. ✅ **Redis Rate Limiting** (4 hours)
2. ✅ **Scan Diff Tracking** (8 hours)

### Month 1 (Stability)
3. Smart Retry & Dead Letter Queue
4. Enhanced Security Headers
5. Database Optimization

### Month 2-3 (Scale)
6. Multi-Region Deployment
7. Advanced Caching
8. Real-Time Collaboration

### Month 4+ (Growth)
9. Enhanced Analytics
10. SOC 2 Preparation
11. Advanced Monitoring

**ROI Priority**:
1. **Scan Diff** = Customer retention (shows progress)
2. **Redis Rate Limiting** = Reliability improvement
3. **Security Headers** = Trust & compliance
4. **Dead Letter Queue** = Operational efficiency
5. **Multi-Region** = Market expansion