-- Migration: Convert scan IDs from integer to UUID
-- This fixes the schema mismatch between scan_jobs.scan_id (UUID) and scans.id (int)

-- Step 1: Add UUID column to scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid();

-- Step 2: Backfill UUID values for existing records
UPDATE scans SET id_uuid = gen_random_uuid() WHERE id_uuid IS NULL;

-- Step 3: Add unique constraint on new UUID column
ALTER TABLE scans ADD CONSTRAINT scans_id_uuid_unique UNIQUE (id_uuid);

-- Step 4: Update dependent tables to reference UUID
-- First, add temporary column to maintain relationships
ALTER TABLE scan_jobs ADD COLUMN IF NOT EXISTS scan_id_temp INTEGER;
UPDATE scan_jobs sj SET scan_id_temp = s.id 
FROM scans s WHERE sj.scan_id::text = s.id_uuid::text;

-- Step 5: Drop old foreign key if exists
ALTER TABLE scan_jobs DROP CONSTRAINT IF EXISTS scan_jobs_scan_id_fkey;

-- Step 6: Update scan_jobs to use UUID properly
ALTER TABLE scan_jobs ALTER COLUMN scan_id TYPE UUID USING (
  SELECT s.id_uuid FROM scans s WHERE s.id = scan_jobs.scan_id_temp
);

-- Step 7: Rename columns in scans table
ALTER TABLE scans RENAME COLUMN id TO id_int;
ALTER TABLE scans RENAME COLUMN id_uuid TO id;

-- Step 8: Set new primary key
ALTER TABLE scans DROP CONSTRAINT IF EXISTS scans_pkey;
ALTER TABLE scans ADD CONSTRAINT scans_pkey PRIMARY KEY (id);

-- Step 9: Re-establish foreign key
ALTER TABLE scan_jobs ADD CONSTRAINT scan_jobs_scan_id_fkey 
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE;

-- Step 10: Clean up temporary column
ALTER TABLE scan_jobs DROP COLUMN IF EXISTS scan_id_temp;

-- Step 11: Create normalized findings table
CREATE TABLE IF NOT EXISTS scan_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  impact TEXT CHECK (impact IN ('critical','serious','moderate','minor')),
  wcag TEXT,
  rule_id TEXT NOT NULL,
  node_path TEXT,
  snippet TEXT,
  help_url TEXT,
  meta JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scan_findings_scan_id_idx ON scan_findings(scan_id);
CREATE INDEX IF NOT EXISTS scan_findings_impact_idx ON scan_findings(impact);

-- Step 12: Create org entitlements table
CREATE TABLE IF NOT EXISTS org_entitlements (
  org_id UUID PRIMARY KEY,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'starter', 'pro', 'enterprise')),
  pages_per_scan INTEGER NOT NULL,
  scans_per_month INTEGER NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  renewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

-- Step 13: Create audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  org_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_org_id_idx ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at);