-- Job Queue System for reliable Vercel → Railway handoff
-- Uses Supabase with row-locking for atomic job claiming

-- Job queue table
CREATE TABLE IF NOT EXISTS scan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  url TEXT NOT NULL,
  depth TEXT DEFAULT 'standard' CHECK (depth IN ('quick', 'standard', 'deep')),
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','claimed','processing','done','failed')),
  priority INT DEFAULT 5,
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  worker_id TEXT,
  scan_id INT REFERENCES scans(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS scan_jobs_queue_idx ON scan_jobs (status, priority, created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS scan_jobs_org_idx ON scan_jobs (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS scan_jobs_worker_idx ON scan_jobs (worker_id, claimed_at DESC);

-- Atomic job claiming function using SKIP LOCKED
CREATE OR REPLACE FUNCTION claim_next_job(p_worker_id TEXT)
RETURNS scan_jobs AS $$
DECLARE 
  j scan_jobs;
BEGIN
  -- Claim next available job atomically
  SELECT *
  INTO j
  FROM scan_jobs
  WHERE status = 'queued'
  ORDER BY priority ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- Return NULL if no jobs available
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Update job as claimed
  UPDATE scan_jobs
  SET 
    status = 'claimed',
    claimed_at = NOW(),
    worker_id = p_worker_id,
    attempts = attempts + 1
  WHERE id = j.id
  RETURNING * INTO j;

  RETURN j;
END;
$$ LANGUAGE plpgsql;

-- Complete job function
CREATE OR REPLACE FUNCTION complete_job(p_job_id UUID, p_scan_id INT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE scan_jobs
  SET 
    status = 'done',
    completed_at = NOW(),
    scan_id = p_scan_id
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Fail job function
CREATE OR REPLACE FUNCTION fail_job(p_job_id UUID, p_error TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE scan_jobs
  SET 
    status = 'failed',
    last_error = p_error,
    completed_at = NOW()
  WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old completed jobs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM scan_jobs
  WHERE status IN ('done', 'failed')
    AND completed_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Worker heartbeat table for monitoring
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id TEXT PRIMARY KEY,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  jobs_processed INT DEFAULT 0,
  last_job_at TIMESTAMPTZ
);

-- Upsert heartbeat function
CREATE OR REPLACE FUNCTION update_worker_heartbeat(
  p_worker_id TEXT,
  p_jobs_processed INT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO worker_heartbeats (worker_id, jobs_processed, last_job_at)
  VALUES (p_worker_id, COALESCE(p_jobs_processed, 0), CASE WHEN p_jobs_processed > 0 THEN NOW() ELSE NULL END)
  ON CONFLICT (worker_id)
  DO UPDATE SET
    last_heartbeat = NOW(),
    status = 'active',
    jobs_processed = CASE 
      WHEN p_jobs_processed IS NOT NULL THEN worker_heartbeats.jobs_processed + 1
      ELSE worker_heartbeats.jobs_processed
    END,
    last_job_at = CASE 
      WHEN p_jobs_processed IS NOT NULL THEN NOW()
      ELSE worker_heartbeats.last_job_at
    END;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON TABLE scan_jobs IS 'Job queue for reliable Vercel → Railway scan processing';
COMMENT ON FUNCTION claim_next_job(TEXT) IS 'Atomically claims next available job using SKIP LOCKED';
COMMENT ON TABLE worker_heartbeats IS 'Worker health monitoring and statistics';