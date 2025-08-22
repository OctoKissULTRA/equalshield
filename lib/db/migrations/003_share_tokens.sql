-- Share Tokens for Shareable Report Links
-- Enables secure, time-limited, revocable links to scan reports

CREATE TABLE IF NOT EXISTS share_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id VARCHAR(255) NOT NULL, -- Using VARCHAR to match existing teams table
  scan_id UUID NOT NULL,
  token_hash BYTEA NOT NULL,                 -- SHA-256 of raw token
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  max_views INTEGER NOT NULL DEFAULT 100,
  views INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(255) NOT NULL, -- Using VARCHAR to match existing users
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS share_tokens_scan_idx ON share_tokens(scan_id);
CREATE INDEX IF NOT EXISTS share_tokens_token_hash_idx ON share_tokens(token_hash);
CREATE INDEX IF NOT EXISTS share_tokens_org_id_idx ON share_tokens(org_id);
CREATE INDEX IF NOT EXISTS share_tokens_expires_at_idx ON share_tokens(expires_at);

-- Cleanup function for expired tokens (can be called by cron)
CREATE OR REPLACE FUNCTION cleanup_expired_share_tokens()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM share_tokens 
  WHERE expires_at < NOW() 
    AND (revoked_at IS NOT NULL OR expires_at < NOW() - INTERVAL '7 days');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;