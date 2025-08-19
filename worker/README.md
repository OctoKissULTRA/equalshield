# EqualShield Worker

The worker service that powers EqualShield's web accessibility scanning engine.

## Architecture

```
INGEST → EXTRACT → ANALYZE → ACT
  ↓         ↓         ↓        ↓
Crawl    Structure  AI+Rules  Money
```

## Features

- **Canonical Page Extraction**: Converts any webpage into structured JSON
- **Rule Engine**: Deterministic WCAG 2.1 AA compliance checks
- **GPT-5 Analysis**: Contextual intelligence for complex accessibility issues
- **Browserless Support**: Works in serverless environments
- **Job Queue**: Polling-based queue with automatic retries

## Quick Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/equalshield)

## Manual Deployment

1. Install Railway CLI:
```bash
npm install -g @railway/cli
```

2. Login and create project:
```bash
railway login
railway init
```

3. Set environment variables:
```bash
railway variables set SUPABASE_URL="your_supabase_url"
railway variables set SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"
railway variables set OPENAI_API_KEY="your_openai_api_key"
railway variables set BROWSERLESS_WS_URL="wss://chrome.browserless.io/playwright?token=your_token"
```

4. Deploy:
```bash
railway up
```

## Local Development

1. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your values
```

2. Install dependencies:
```bash
npm install
```

3. Run worker:
```bash
npm run dev
```

## Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for admin access
- `OPENAI_API_KEY`: OpenAI API key for GPT-5
- `BROWSERLESS_WS_URL`: (Optional) Browserless WebSocket URL for serverless Chrome
- `PORT`: Health check port (default: 3000)

## Monitoring

View logs:
```bash
railway logs
```

Check worker health:
```bash
curl https://your-worker.railway.app/health
```

## Scaling

To run multiple workers:
```bash
railway scale --replicas 3
```

## Database Setup

Before running the worker, ensure you've run the database migrations:

1. Run `database-setup.sql` in Supabase
2. Run `database-worker-upgrade.sql` for worker-specific tables

## How It Works

1. Main app creates scan with `status: 'pending'`
2. Worker polls for pending scans every 5 seconds
3. Worker claims scan and sets `status: 'processing'`
4. Worker extracts canonical page structure
5. Rule engine runs deterministic WCAG checks
6. GPT-5 analyzes for contextual issues
7. Results stored with `status: 'complete'`
8. Main app shows results to user

## Extending

To add new analysis types, create new analyzers:

```javascript
class SEOAnalyzer {
  static analyze(canonicalPage) {
    // Your SEO analysis logic
  }
}
```

The canonical page structure makes it easy to add:
- SEO analysis
- Performance audits
- Content quality checks
- Conversion optimization
- Security scanning