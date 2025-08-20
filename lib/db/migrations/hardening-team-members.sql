-- Database hardening for team_members table
-- Ensures data integrity and prevents null user references

-- First, clean up any existing orphaned records (if any)
DELETE FROM team_members 
WHERE user_id IS NULL;

-- Remove any orphaned team_members where user no longer exists
DELETE FROM team_members tm
WHERE NOT EXISTS (
  SELECT 1 FROM users u WHERE u.id = tm.user_id
);

-- Make user_id NOT NULL (should already be, but ensuring it)
ALTER TABLE team_members 
  ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraint with CASCADE delete
-- This ensures referential integrity
ALTER TABLE team_members 
  ADD CONSTRAINT IF NOT EXISTS team_members_user_fk 
  FOREIGN KEY (user_id) REFERENCES users(id) 
  ON DELETE CASCADE;

-- Add foreign key constraint for team_id as well
ALTER TABLE team_members 
  ADD CONSTRAINT IF NOT EXISTS team_members_team_fk 
  FOREIGN KEY (team_id) REFERENCES teams(id) 
  ON DELETE CASCADE;

-- Prevent duplicate team memberships
CREATE UNIQUE INDEX IF NOT EXISTS team_member_unique 
  ON team_members(team_id, user_id);

-- Add helpful comments
COMMENT ON CONSTRAINT team_members_user_fk ON team_members 
  IS 'Ensures team members always reference valid users';
COMMENT ON CONSTRAINT team_members_team_fk ON team_members 
  IS 'Ensures team members always reference valid teams';
COMMENT ON INDEX team_member_unique 
  IS 'Prevents duplicate memberships for same user in same team';