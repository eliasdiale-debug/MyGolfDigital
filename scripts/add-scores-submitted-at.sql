-- Add scores_submitted_at column to pairings table to track when a player submits scores for captain review
ALTER TABLE pairings ADD COLUMN IF NOT EXISTS scores_submitted_at TIMESTAMPTZ DEFAULT NULL;
