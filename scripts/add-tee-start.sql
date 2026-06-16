-- Add tee_start column to adhoc_games
-- '1'     = single tee, all groups start from hole 1
-- 'split' = two-tee start, groups alternate between hole 1 and hole 10

ALTER TABLE adhoc_games
  ADD COLUMN IF NOT EXISTS tee_start TEXT NOT NULL DEFAULT '1'
    CHECK (tee_start IN ('1', 'split'));
