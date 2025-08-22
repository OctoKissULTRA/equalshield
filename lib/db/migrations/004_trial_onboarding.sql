-- Trial Organizations for Zero-Friction Onboarding
-- Enables anonymous trial scans without account creation

CREATE TABLE IF NOT EXISTS trial_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL,
  pages_per_scan INTEGER NOT NULL DEFAULT 5,
  scans_remaining INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- NOW() + INTERVAL '7 days'
  ip INET,
  user_agent TEXT,
  
  -- Additional tracking fields
  completed_scans INTEGER NOT NULL DEFAULT 0,
  upgraded_at TIMESTAMPTZ,
  upgraded_to_org_id VARCHAR(255) -- References real org after upgrade
);

-- Trial Sessions for Cookie-Based Tracking
CREATE TABLE IF NOT EXISTS trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trial_org_id UUID NOT NULL REFERENCES trial_orgs(id) ON DELETE CASCADE,
  cookie_id TEXT NOT NULL UNIQUE, -- base64url 24B token
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Session tracking
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT,
  ip INET
);

-- Add trial tracking to scans table
ALTER TABLE scans ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS trial_org_id UUID REFERENCES trial_orgs(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS trial_orgs_domain_idx ON trial_orgs(domain);
CREATE INDEX IF NOT EXISTS trial_orgs_ip_idx ON trial_orgs(ip);
CREATE INDEX IF NOT EXISTS trial_orgs_expires_at_idx ON trial_orgs(expires_at);
CREATE INDEX IF NOT EXISTS trial_sessions_cookie_id_idx ON trial_sessions(cookie_id);
CREATE INDEX IF NOT EXISTS trial_sessions_trial_org_id_idx ON trial_sessions(trial_org_id);
CREATE INDEX IF NOT EXISTS scans_trial_org_id_idx ON scans(trial_org_id);

-- Function to clean up expired trials
CREATE OR REPLACE FUNCTION cleanup_expired_trials()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete expired trial sessions first (cascade will handle related data)
  DELETE FROM trial_sessions 
  WHERE expires_at < NOW();
  
  -- Delete expired trial orgs that haven't been upgraded
  DELETE FROM trial_orgs 
  WHERE expires_at < NOW() 
    AND upgraded_at IS NULL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Also clean up old trial scans (keep for 30 days after expiry)
  UPDATE scans 
  SET trial_org_id = NULL 
  WHERE is_trial = true 
    AND created_at < NOW() - INTERVAL '30 days';
    
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to migrate trial to real org
CREATE OR REPLACE FUNCTION migrate_trial_to_org(
  p_trial_org_id UUID,
  p_dest_org_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Start transaction
  BEGIN
    -- Update scans to point to real org
    UPDATE scans 
    SET org_id = p_dest_org_id,
        is_trial = false,
        trial_org_id = NULL
    WHERE trial_org_id = p_trial_org_id;
    
    -- Mark trial org as upgraded
    UPDATE trial_orgs 
    SET upgraded_at = NOW(),
        upgraded_to_org_id = p_dest_org_id
    WHERE id = p_trial_org_id;
    
    -- Keep trial_sessions for analytics but could be cleaned up later
    -- DELETE FROM trial_sessions WHERE trial_org_id = p_trial_org_id;
    
    RETURN true;
  EXCEPTION WHEN OTHERS THEN
    -- Rollback will happen automatically
    RETURN false;
  END;
END;
$$ LANGUAGE plpgsql;