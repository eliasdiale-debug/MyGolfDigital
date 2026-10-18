-- Add tee_off_time column to pairings table so each fourball group
-- can carry its individual staggered start time (9 minutes apart).
ALTER TABLE pairings
  ADD COLUMN IF NOT EXISTS tee_off_time time without time zone;
