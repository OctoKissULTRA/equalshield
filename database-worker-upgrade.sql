-- Worker Architecture Database Upgrade
-- Run this after the initial database-setup.sql

-- Add canonical_page column to store extracted page structure
ALTER TABLE scans 
ADD COLUMN IF NOT EXISTS canonical_page JSONB,
ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;

-- Create index for worker polling
CREATE INDEX IF NOT EXISTS idx_scans_pending ON scans(status, created_at) 
WHERE status = 'pending';

-- Create index for canonical page queries
CREATE INDEX IF NOT EXISTS idx_scans_canonical ON scans 
USING GIN (canonical_page);

-- Add artifacts table for screenshots, PDFs, etc.
CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'screenshot', 'pdf_report', 'patch', 'full_page_screenshot'
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_scan ON artifacts(scan_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_type ON artifacts(type);

-- Add flows table for identified user journeys
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  flow_type VARCHAR(50), -- 'checkout', 'signup', 'contact', 'search'
  steps JSONB,
  accessibility_score INT,
  issues JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flows_scan ON flows(scan_id);

-- Create scan_jobs table for better queue management
CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES scans(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending',
  priority INT DEFAULT 0,
  attempts INT DEFAULT 0,
  max_attempts INT DEFAULT 3,
  worker_id VARCHAR(100),
  claimed_at TIMESTAMP,
  completed_at TIMESTAMP,
  failed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON scan_jobs(status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_worker ON scan_jobs(worker_id);

-- Function to claim next job atomically
CREATE OR REPLACE FUNCTION claim_next_job(p_worker_id TEXT)
RETURNS TABLE (
  job_id UUID,
  scan_id UUID,
  url TEXT,
  tier TEXT
) 
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_id UUID;
  v_scan_id UUID;
BEGIN
  -- Find and lock the next available job
  SELECT j.id, j.scan_id INTO v_job_id, v_scan_id
  FROM scan_jobs j
  WHERE j.status = 'pending'
    AND j.attempts < j.max_attempts
  ORDER BY j.priority DESC, j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_job_id IS NULL THEN
    RETURN; -- No jobs available
  END IF;
  
  -- Update the job as claimed
  UPDATE scan_jobs
  SET status = 'processing',
      worker_id = p_worker_id,
      claimed_at = NOW(),
      attempts = attempts + 1
  WHERE id = v_job_id;
  
  -- Return job details
  RETURN QUERY
  SELECT 
    v_job_id as job_id,
    s.id as scan_id,
    s.url,
    o.subscription_tier as tier
  FROM scans s
  LEFT JOIN organizations o ON s.organization_id = o.id
  WHERE s.id = v_scan_id;
END;
$$;

-- Function to mark job as complete
CREATE OR REPLACE FUNCTION complete_job(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scan_jobs
  SET status = 'complete',
      completed_at = NOW()
  WHERE id = p_job_id;
END;
$$;

-- Function to mark job as failed
CREATE OR REPLACE FUNCTION fail_job(p_job_id UUID, p_error TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE scan_jobs
  SET status = 'failed',
      failed_at = NOW(),
      error_message = p_error
  WHERE id = p_job_id;
END;
$$;

-- Grant permissions to service role
GRANT EXECUTE ON FUNCTION claim_next_job TO service_role;
GRANT EXECUTE ON FUNCTION complete_job TO service_role;
GRANT EXECUTE ON FUNCTION fail_job TO service_role;

-- Page view metering for Stripe tier enforcement
CREATE OR REPLACE FUNCTION increment_page_views(p_team_id INTEGER, p_amount INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reset daily counter if needed
  UPDATE teams 
  SET updated_at = NOW()
  WHERE id = p_team_id 
    AND (updated_at::date < CURRENT_DATE);
    
  -- Increment page views
  UPDATE teams
  SET updated_at = NOW()
  WHERE id = p_team_id;
  
  -- Insert usage event for billing tracking
  INSERT INTO usage_events (team_id, event_type, count, metadata, created_at)
  VALUES (p_team_id, 'page_scan', p_amount, '{"source": "api"}', NOW());
END;
$$;

-- Enforce free tier limits (100 scans per day)
CREATE OR REPLACE FUNCTION enforce_free_tier_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  daily_scans INTEGER;
  team_plan TEXT;
BEGIN
  -- Get team plan
  SELECT plan_name INTO team_plan 
  FROM teams 
  WHERE id = NEW.team_id;
  
  -- Check free tier limits
  IF team_plan = 'free' OR team_plan IS NULL THEN
    -- Count scans today
    SELECT COUNT(*) INTO daily_scans
    FROM scans 
    WHERE team_id = NEW.team_id 
      AND created_at::date = CURRENT_DATE;
      
    IF daily_scans >= 100 THEN
      RAISE EXCEPTION 'Free tier daily scan limit (100) exceeded. Please upgrade your plan.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply trigger to scans table
DROP TRIGGER IF EXISTS enforce_free_limits_trigger ON scans;
CREATE TRIGGER enforce_free_limits_trigger
  BEFORE INSERT ON scans
  FOR EACH ROW
  EXECUTE FUNCTION enforce_free_tier_limits();

-- Grant permissions
GRANT EXECUTE ON FUNCTION increment_page_views TO service_role;
GRANT EXECUTE ON FUNCTION enforce_free_tier_limits TO service_role;