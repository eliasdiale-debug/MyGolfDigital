-- Migration: Allow same member name in different clubs
-- Drop the existing unique constraint on member_name only
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_member_name_key;

-- Add a new composite unique constraint: same name + contact in same club is not allowed
-- But same name in different clubs IS allowed
ALTER TABLE members ADD CONSTRAINT members_name_contact_club_unique 
  UNIQUE (member_name, contact_number, club_id);

-- Verify the constraint was created
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'members'::regclass AND contype = 'u';
