# Sprint 3.10 Environment Variables

## Required Environment Variables for Trust Page & Self-Scanning

Add these to your Vercel environment variables or `.env.local`:

```bash
# Trust Page & Self-Scanning
TRUST_CRON_SECRET=your-secure-random-string-for-cron-auth
SELF_SCAN_URL=https://equalshield.com
SELF_SCAN_ORG_ID=your-internal-org-uuid

# Optional: For enhanced security
VERCEL_CRON_SECRET=vercel-specific-cron-secret
```

## Environment Variable Details

### `TRUST_CRON_SECRET`
- **Purpose**: Secures the `/api/cron/self-scan` and `/api/cron/publish-sample` endpoints
- **Format**: Random secure string (recommend 32+ characters)
- **Example**: `sk_trust_1234567890abcdef...`
- **Used by**: Cron authentication in `lib/security/cron-auth.ts`

### `SELF_SCAN_URL` 
- **Purpose**: The URL of your own website to scan for trust page
- **Format**: Full HTTPS URL
- **Example**: `https://equalshield.com`
- **Used by**: Self-scan cron to determine what domain to scan

### `SELF_SCAN_ORG_ID`
- **Purpose**: Your internal organization ID for self-scans
- **Format**: UUID string
- **Example**: `550e8400-e29b-41d4-a716-446655440000`
- **Used by**: Self-scan cron to associate scans with your organization

## Vercel Cron Schedule

The following cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/self-scan",
      "schedule": "0 9 * * 1"
    },
    {
      "path": "/api/cron/publish-sample", 
      "schedule": "0 10 * * 1"
    }
  ]
}
```

- **Self-scan**: Runs every Monday at 9:00 AM UTC
- **Sample publishing**: Runs every Monday at 10:00 AM UTC (1 hour after self-scan)

## Security Notes

1. **Cron Authentication**: All cron endpoints require `Authorization: Bearer <TRUST_CRON_SECRET>` header
2. **SSRF Protection**: Self-scan URLs are validated through existing URL guard system
3. **Rate Limiting**: Self-scans use highest priority (1) in the job queue
4. **Token Security**: Sample share tokens use the same security as regular share tokens (SHA-256 hashing)

## Testing Cron Jobs Locally

```bash
# Test self-scan endpoint
curl -X GET http://localhost:3000/api/cron/self-scan \
  -H "Authorization: Bearer $TRUST_CRON_SECRET"

# Test sample publishing endpoint  
curl -X GET http://localhost:3000/api/cron/publish-sample \
  -H "Authorization: Bearer $TRUST_CRON_SECRET"
```

## Database Migrations

Apply these migrations for Sprint 3.10:

1. `004_trial_fix.sql` - Trial scan consumption bug fix
2. `005_sample_tokens.sql` - Sample token management functions

## Trust Page URLs

- **Trust page**: `/trust`
- **Homepage**: `/` (updated with marketing-safe copy)
- **Trial page**: `/trial` (existing from Sprint 3.9)

## Analytics Events

New analytics events for trust page:
- `trust.viewed`
- `trust.sample_clicked` 
- `trust.pdf_downloaded`
- `trust.selfscan.scheduled`
- `trust.sample.published`