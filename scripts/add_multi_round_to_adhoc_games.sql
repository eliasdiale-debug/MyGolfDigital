-- Add multi-round support to adhoc_games
ALTER TABLE adhoc_games
  ADD COLUMN IF NOT EXISTS is_multi_round boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_rounds integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS end_date date;

COMMENT ON COLUMN adhoc_games.is_multi_round IS 'True if the game spans multiple rounds across multiple days';
COMMENT ON COLUMN adhoc_games.total_rounds IS 'Total number of rounds in the game (1 for single round)';
COMMENT ON COLUMN adhoc_games.end_date IS 'Last day of a multi-round game (NULL for single-day games)';
