# 🔄 Environment Configuration Migration Guide

## Quick Start (2 minutes)

```bash
# 1. Generate the example template
npm run env:example

# 2. Check your current environment
npm run env:check

# 3. Fix any validation errors shown
# 4. Test locally
npm run dev
```

## What Changed?

### ✅ New Benefits
- **Type-safe** environment access with validation at boot
- **Clear error messages** when something is missing or wrong
- **Single source of truth** in `lib/config/env.ts`
- **Automatic documentation** via `.env.example`
- **Feature flags** properly typed and validated

### 🔧 Code Migration

#### Before (unsafe):
```typescript
// ❌ Old way - no validation, runtime errors
const apiKey = process.env.OPENAI_API_KEY;
const maxTokens = parseInt(process.env.MAX_TOKENS || "1000");
if (process.env.FEATURE_ENABLED === "true") { 
  // ...
}
```

#### After (type-safe):
```typescript
// ✅ New way - validated, typed, safe
import { env, isFeatureEnabled } from '@/lib/config/env';

const apiKey = env.OPENAI_API_KEY; // Type: string | undefined
const maxTokens = env.LLM_MAX_TOKENS; // Type: number (already parsed!)
if (isFeatureEnabled('trial')) {
  // ...
}
```

## Migration Checklist

### 1. Update Import Statements
```typescript
// Replace all direct process.env usage
- const key = process.env.STRIPE_SECRET_KEY;
+ import { env } from '@/lib/config/env';
+ const key = env.STRIPE_SECRET_KEY;
```

### 2. Update Supabase Client
```typescript
// lib/supabase/server.ts
import { env } from '@/lib/config/env';

export function createSupabaseClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
  );
}
```

### 3. Update Worker Configuration
```typescript
// worker/queue-processor.js
import { getEnv } from '../lib/config/env';

const env = getEnv(); // Validates on startup
const openai = new OpenAI({ 
  apiKey: env.OPENAI_API_KEY 
});
```

### 4. Update API Routes
```typescript
// app/api/cron/self-scan/route.ts
import { env } from '@/lib/config/env';

export async function GET(req: NextRequest) {
  requireCron(req, env.TRUST_CRON_SECRET);
  const url = env.SELF_SCAN_URL;
  const orgId = env.SELF_SCAN_ORG_ID;
  // ...
}
```

### 5. Update Feature Flags
```typescript
// components/TrialBanner.tsx
import { isFeatureEnabled } from '@/lib/config/env';

export function TrialBanner() {
  if (!isFeatureEnabled('trial')) return null;
  // ...
}
```

## Environment Variables Reference

### Required for All Environments
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
TRUST_CRON_SECRET
SELF_SCAN_URL
SELF_SCAN_ORG_ID
```

### Required for Production
```
NODE_ENV=production
SENTRY_DSN
NEXT_PUBLIC_APP_URL
```

### Optional Features
```
# AI Insights
AI_SUMMARIZER_ENABLED=true
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Redis Rate Limiting
RATE_LIMIT_BACKEND=redis
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

## Debugging Environment Issues

### Check what's missing:
```bash
npm run env:check
```

### Common Errors and Fixes:

**"OPENAI_API_KEY required when AI_SUMMARIZER_ENABLED=true"**
- Either set `OPENAI_API_KEY` or set `AI_SUMMARIZER_ENABLED=false`

**"Must be a valid UUID for self-scan organization"**
- Generate a UUID: `npx uuid` or use `00000000-0000-0000-0000-000000000000`

**"Invalid Stripe price ID format"**
- Price IDs must start with `price_`
- Get from Stripe Dashboard → Products → Pricing

## CI/CD Configuration

### GitHub Actions
```yaml
- name: Validate Environment
  run: npm run env:check
  env:
    NODE_ENV: test
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    # ... other required vars
```

### Vercel
```bash
# Pull production env locally
vercel env pull .env.production.local

# List all env vars
vercel env ls

# Add new var
vercel env add OPENAI_API_KEY
```

### Railway
```bash
# Set via CLI
railway variables set OPENAI_API_KEY=sk-...

# Or use dashboard
railway.app → Project → Variables
```

## Rollback Plan

If you need to temporarily disable validation:

1. Comment out the `getEnv()` call in your app initialization
2. Use `process.env` directly (not recommended)
3. Fix the validation errors
4. Re-enable validation

## Support

**Environment validation failed?**
1. Run `npm run env:check` to see what's wrong
2. Check `.env.example` for correct format
3. Verify values in hosting dashboard

**Type errors after migration?**
1. Run `npm run type-check`
2. Update imports to use `@/lib/config/env`
3. Use the typed `env` object instead of `process.env`