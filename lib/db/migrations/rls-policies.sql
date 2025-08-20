-- Row Level Security (RLS) policies for production security
-- MVP approach: public read with server-side writes

-- Enable RLS on core tables
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_heartbeats ENABLE ROW LEVEL SECURITY;

-- Teams policies
-- Public read access for MVP (tighten later with user authentication)
CREATE POLICY teams_read_public ON teams
  FOR SELECT USING (true);

-- Server-only writes (service role bypasses RLS)
CREATE POLICY teams_write_service ON teams
  FOR ALL USING (false);

-- Scans policies
-- Public read for scan results by scan ID (MVP)
CREATE POLICY scans_read_public ON scans
  FOR SELECT USING (true);

-- Server-only writes
CREATE POLICY scans_write_service ON scans
  FOR ALL USING (false);

-- Job queue policies
-- Public read for job status checking
CREATE POLICY scan_jobs_read_public ON scan_jobs
  FOR SELECT USING (true);

-- Server-only writes and updates
CREATE POLICY scan_jobs_write_service ON scan_jobs
  FOR ALL USING (false);

-- Worker heartbeats policies
-- Admin read only for monitoring
CREATE POLICY worker_heartbeats_read_admin ON worker_heartbeats
  FOR SELECT USING (false); -- Will be bypassed by service role

-- Server-only writes
CREATE POLICY worker_heartbeats_write_service ON worker_heartbeats
  FOR ALL USING (false);

-- Revoke direct table access from anonymous and authenticated users
-- Force all operations through API routes with proper validation
REVOKE ALL ON teams FROM anon, authenticated;
REVOKE ALL ON scans FROM anon, authenticated;
REVOKE ALL ON scan_jobs FROM anon, authenticated;
REVOKE ALL ON worker_heartbeats FROM anon, authenticated;

-- Grant limited SELECT access to public users (for status checking)
GRANT SELECT ON scans TO anon, authenticated;
GRANT SELECT ON scan_jobs TO anon, authenticated;

-- Service role (used by API routes and worker) bypasses all RLS policies
-- This is handled by Supabase automatically when using the service role key

-- Comments for documentation
COMMENT ON POLICY teams_read_public ON teams IS 'MVP: Allow public read access to team data';
COMMENT ON POLICY scans_read_public ON scans IS 'MVP: Allow public read access to scan results';
COMMENT ON POLICY scan_jobs_read_public ON scan_jobs IS 'Allow public status checking of scan jobs';

-- TODO for production:
-- 1. Replace public policies with user/team-scoped policies
-- 2. Add proper authentication checks
-- 3. Implement team membership validation
-- 4. Add audit logging for sensitive operations