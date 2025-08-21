# EqualShield Project - Railway Deployment Status & Context

## 🚀 **PROJECT OVERVIEW**
EqualShield is an enterprise-grade accessibility compliance platform that provides:
- Automated WCAG 2.1 AA compliance scanning using Puppeteer + axe-core
- GPT-5 powered contextual accessibility analysis
- VPAT documentation generation for federal procurement
- Professional pricing tiers ($997-$2,497/month)
- Built with Next.js 15, TypeScript, PostgreSQL, Drizzle ORM, and Stripe

**Repository**: https://github.com/OctoKissULTRA/equalshield.git
**Local Path**: `C:\Users\jbroh\Documents\GitHub\equalshield`
**SSH Key**: SHA256:lsS/EjcTXO5ibxz9XAUwLLU6ta8/IbCdqBFsOg8fCEM

---

## 🎯 **CURRENT STATUS: PRODUCTION-READY JOB QUEUE SYSTEM**
**Last Session**: Implemented reliable Vercel ↔ Railway job queue architecture

### ✅ **COMPLETED IMPLEMENTATION**
1. **Production Job Queue** - Reliable Supabase-based queue with atomic row-locking
2. **Vercel ↔ Railway Separation** - Clean handoff between web app and worker services
3. **Real-time Status Tracking** - Job progress monitoring with polling API
4. **Worker Health Monitoring** - Heartbeat system and admin dashboard
5. **Automated Scheduling** - Vercel cron for daily scans
6. **Security & Observability** - RLS policies, Sentry tracking, error handling

### 📋 **KEY TECHNICAL DECISIONS**
- **Only OpenAI GPT-5 is used** - All Anthropic/Claude code removed
- **Lazy SDK pattern** - All external service clients initialize at request time only
- **Database hardening** - FK constraints and NOT NULL enforcement added
- **Runtime configuration** - All API routes use `runtime='nodejs'` and `dynamic='force-dynamic'`

---

## 🚀 **NEW: JOB QUEUE ARCHITECTURE**

### **Request Flow**
```
1. User submits scan → POST /api/scan
2. Vercel enqueues job → Supabase scan_jobs table  
3. Railway worker claims job → SKIP LOCKED atomic claim
4. Worker processes scan → GPT-5 analysis + results
5. Worker updates job status → Complete with scan_id
6. Frontend polls status → GET /api/scan/job/[id]
7. Redirect to results → GET /scan/[scanId]
```

### **Key Components**
- **Job Queue**: Supabase table with atomic claiming using PostgreSQL SKIP LOCKED
- **Worker Pool**: Railway containers processing jobs from queue
- **Status Polling**: Real-time job progress tracking
- **Health Monitoring**: Worker heartbeats and admin dashboard
- **Scheduled Scans**: Vercel cron for daily automated scans

---

## 🏗️ **ARCHITECTURE OVERVIEW**

### **Core Stack**
- **Frontend**: Next.js 15.4.0-canary.47 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based sessions
- **Payments**: Stripe with lazy client pattern
- **AI**: OpenAI GPT-5 (model: gpt-5-2025-08-07)
- **Scanning**: Puppeteer + @axe-core/puppeteer

### **Key Directories**
```
├── app/                    # Next.js app directory
│   ├── api/               # API routes (all with lazy clients)
│   ├── (dashboard)/       # Dashboard pages
│   └── (login)/           # Authentication pages
├── lib/
│   ├── clients/           # Lazy SDK clients (NEW)
│   │   ├── stripe.ts      # getStripe() lazy client
│   │   └── openai.ts      # getOpenAI() lazy client
│   ├── db/                # Database layer
│   │   ├── drizzle.ts     # Lazy DB connection
│   │   ├── queries.ts     # Optimized queries
│   │   └── migrations/    # DB hardening scripts
│   ├── auth/              # Authentication middleware
│   └── payments/          # Stripe integration
├── worker/                # Background scanning service
│   ├── index.js           # Main worker (uses GPT-5)
│   ├── Dockerfile         # Railway worker deployment
│   └── railway.json       # Worker configuration
└── scripts/               # CLI utilities (excluded from build)
```

---

## 🔧 **RAILWAY DEPLOYMENT CONFIGURATION**

### **Main App Configuration** (`railway.json`)
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 10,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### **Worker Configuration** (`worker/railway.json`)
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "worker/Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### **Required Environment Variables**

#### **Vercel (Web App)**
```bash
# Database (for teams/auth)
POSTGRES_URL=postgresql://user:pass@host:port/db
DATABASE_URL=postgresql://user:pass@host:port/db  # Fallback

# Job Queue
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_here

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# App Configuration
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=your_secure_cron_secret
SENTRY_DSN=https://sentry.io/dsn  # Optional

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW_MS=900000
```

#### **Railway (Worker)**
```bash
# Job Queue (REQUIRED)
SUPABASE_URL=https://project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service_role_key_here

# AI Services (REQUIRED)
OPENAI_API_KEY=sk-...  # For GPT-5

# Worker Configuration
WORKER_ID=railway-worker-1  # Optional, auto-generated
POLL_INTERVAL_MS=5000       # Optional, default 5000
PORT=3000                   # Optional, default 3000

# Browser (Optional - uses local Playwright if not set)
BROWSERLESS_WS_URL=wss://chrome.browserless.io?token=...

# Monitoring (Optional)
SENTRY_DSN=https://sentry.io/dsn
```

---

## 🚨 **KNOWN ISSUES & SOLUTIONS**

### **Issue**: Railway Build Failures
**Root Cause**: SDK clients being initialized at module import time
**Solution**: ✅ **FIXED** - Implemented lazy client pattern
- All SDK clients now use getter functions (`getStripe()`, `getOpenAI()`)
- API routes have `runtime='nodejs'` and `dynamic='force-dynamic'`

### **Issue**: TypeScript Compilation Errors
**Root Cause**: Database queries returning nullable types when non-null expected
**Solution**: ✅ **FIXED** - Database hardening + query optimization
- INNER JOINs throughout to ensure referential integrity
- Type guards for belt-and-suspenders safety
- FK constraints at database level

### **Issue**: Build scanning CLI scripts
**Root Cause**: Next.js trying to compile seed/utility scripts
**Solution**: ✅ **FIXED** - Excluded from tsconfig
```json
"exclude": [
  "lib/db/seed.ts",
  "scripts/**/*", 
  "worker/**/*"
]
```

---

## 🏃‍♂️ **DEPLOYMENT & TESTING**

### **Immediate Setup Steps**
1. **Database Migrations** - Apply all migration files:
   ```sql
   -- Apply in order:
   -- 1. lib/db/migrations/hardening-team-members.sql
   -- 2. lib/db/migrations/job-queue-system.sql  
   -- 3. lib/db/migrations/rls-policies.sql
   ```

2. **Environment Variables** - Set all required vars in both Vercel and Railway

3. **Test Job Queue System**:
   ```bash
   # 1. Enqueue a job
   curl -X POST https://your-app.vercel.app/api/scan \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com","email":"test@example.com","depth":"quick"}'
   
   # 2. Check job status (replace jobId)
   curl https://your-app.vercel.app/api/scan/job/[jobId]
   
   # 3. Monitor workers
   curl https://your-app.vercel.app/api/admin/workers
   ```

4. **Health Check Endpoints**:
   - Vercel: `https://your-app.vercel.app/api/health`
   - Railway: `https://your-worker.railway.app/health`

### **Stability Improvements**
1. **Pin Next.js Version** - Consider moving from canary to stable:
   ```json
   "next": "14.2.5"  // Instead of 15.4.0-canary.47
   ```
2. **Add Error Monitoring** - Integrate Sentry for production error tracking
3. **Load Testing** - Test GPT-5 API rate limits under load

### **Feature Development**
1. **VPAT Generation** - Implement PDF report generation
2. **Team Management** - Complete invitation/role management features
3. **API Rate Limiting** - Implement per-tier rate limiting

---

## 💡 **DEVELOPMENT PATTERNS ESTABLISHED**

### **Lazy Client Pattern**
```typescript
// lib/clients/service.ts
let clientInstance: ServiceClient | null = null;

export function getService(): ServiceClient {
  if (!clientInstance) {
    const key = process.env.SERVICE_KEY;
    if (!key) throw new Error('SERVICE_KEY not set');
    clientInstance = new ServiceClient(key);
  }
  return clientInstance;
}
```

### **API Route Pattern**
```typescript
// app/api/*/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const client = getService(); // Lazy initialization
  // ... route logic
}
```

### **Database Query Pattern**
```typescript
// Always use INNER JOINs for required relations
const result = await db()
  .select({ /* explicit shape */ })
  .from(table)
  .innerJoin(relatedTable, eq(table.id, relatedTable.tableId))
  .where(conditions);
```

---

## 🔍 **DEBUGGING TOOLS**

### **Health Check Endpoints**
- `/api/health` - Service health + env var status
- `/api/test-integrations` - Database, Stripe, and OpenAI connectivity tests

### **Useful Commands**
```bash
# Local development
npm run dev
npm run db:studio  # Drizzle Studio
npm run type-check

# Database operations  
npm run db:generate  # Generate migrations
npm run db:migrate   # Apply migrations

# Testing
npm run test         # Playwright tests
npm run scanner:test # Accessibility tests
```

### **Railway Debugging**
```bash
railway logs         # View deployment logs
railway status       # Check service status
railway variables    # List environment variables
```

---

## 📝 **SESSION HANDOFF NOTES**
- **Last commit**: `00defdd` - Production job queue system complete
- **Architecture**: ✅ Vercel ↔ Railway job queue fully implemented
- **Status**: Ready for production deployment and scaling
- **Queue System**: Atomic job processing with monitoring and health checks
- **Error Handling**: Comprehensive retry mechanisms and observability

### **What's Ready:**
✅ **Job Queue System** - Production-ready with Supabase backend  
✅ **Worker Scaling** - Railway can auto-scale based on queue backlog  
✅ **Status Tracking** - Real-time job progress and results  
✅ **Health Monitoring** - Worker heartbeats and admin dashboard  
✅ **Scheduled Scans** - Daily automated scanning for paid users  
✅ **Error Recovery** - Graceful failure handling and retries  

### **Next Session Can:**
- Add frontend components for job status polling
- Implement user authentication and team management
- Add CSV/PDF export functionality
- Set up Stripe payment integration
- Scale worker pool based on demand

**System is production-ready for reliable scan processing!** 🎉

---

*Generated: 2025-08-20 | Session: Production job queue system implemented*