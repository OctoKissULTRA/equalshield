-- Fix for trial scan consumption
-- Add missing consume_trial_scan function

CREATE OR REPLACE FUNCTION consume_trial_scan(p_trial_org_id UUID)
RETURNS BOOLEAN
AS $$
BEGIN
  -- Atomically decrement scans_remaining and increment completed_scans
  UPDATE trial_orgs 
  SET scans_remaining = GREATEST(0, scans_remaining - 1),
      completed_scans = completed_scans + 1
  WHERE id = p_trial_org_id 
    AND scans_remaining > 0
    AND upgraded_at IS NULL
    AND expires_at > NOW();
  
  -- Return true if a row was updated
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;