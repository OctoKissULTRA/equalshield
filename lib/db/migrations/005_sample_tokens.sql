-- Sample token management functions
-- For trust page sample report publishing

-- Function to revoke sample share tokens for a domain
CREATE OR REPLACE FUNCTION revoke_sample_share_tokens(p_domain TEXT)
RETURNS INTEGER
AS $$
DECLARE
  revoked_count INTEGER;
BEGIN
  -- Revoke all active share tokens for scans matching the domain
  UPDATE share_tokens 
  SET revoked_at = NOW()
  WHERE scan_id IN (
    SELECT id FROM scans 
    WHERE domain = p_domain 
    AND status = 'completed'
  )
  AND revoked_at IS NULL
  AND expires_at > NOW();
  
  GET DIAGNOSTICS revoked_count = ROW_COUNT;
  
  RETURN revoked_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get latest share token for domain (for trust page)
CREATE OR REPLACE FUNCTION get_latest_domain_share_token(p_domain TEXT)
RETURNS TABLE(
  share_url TEXT,
  scan_id UUID,
  scan_score INTEGER,
  finished_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  -- This is a placeholder function since we can't reconstruct the raw token
  -- The actual implementation would need to store the share URL separately
  -- or use a different approach
  
  RETURN QUERY
  SELECT 
    NULL::TEXT as share_url,
    s.id as scan_id,
    s.score as scan_score,
    s.finished_at,
    st.expires_at
  FROM scans s
  JOIN share_tokens st ON s.id = st.scan_id
  WHERE s.domain = p_domain
    AND s.status = 'completed'
    AND s.finished_at IS NOT NULL
    AND st.revoked_at IS NULL
    AND st.expires_at > NOW()
  ORDER BY s.finished_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;