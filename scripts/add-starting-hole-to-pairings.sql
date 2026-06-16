-- Add starting_hole to pairings table
-- 1 = tees off hole 1, 10 = tees off hole 10 (split tee)
ALTER TABLE pairings ADD COLUMN IF NOT EXISTS starting_hole INTEGER NOT NULL DEFAULT 1;
