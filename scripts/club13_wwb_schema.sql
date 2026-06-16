-- ============================================================
-- Club 13 (Wednesday School) - WWB Competition Schema Migration
-- ============================================================

-- 1. Add WWB opt-in columns to pairings
ALTER TABLE pairings
  ADD COLUMN IF NOT EXISTS wwb_ww BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS wwb_birdie BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS front9_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS back9_points INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_fourball_captain BOOLEAN DEFAULT false;

-- 2. Add WWB game-level flag to adhoc_games
ALTER TABLE adhoc_games
  ADD COLUMN IF NOT EXISTS wwb_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS birdie_pool_fee NUMERIC(10,2) DEFAULT 50.00;

-- 3. Create wwb_results table
CREATE TABLE IF NOT EXISTS wwb_results (
  id                      SERIAL PRIMARY KEY,
  adhoc_game_id           INTEGER NOT NULL REFERENCES adhoc_games(adhoc_game_id) ON DELETE CASCADE,
  club_id                 INTEGER NOT NULL,
  game_date               DATE NOT NULL,

  -- WW Winners
  ww_front9_winner_id     INTEGER REFERENCES members(member_id),
  ww_front9_points        INTEGER,
  ww_back9_winner_id      INTEGER REFERENCES members(member_id),
  ww_back9_points         INTEGER,
  ww_overall_winner_id    INTEGER REFERENCES members(member_id),
  ww_overall_points       INTEGER,

  -- Birdie Pool
  birdie_pool_total       NUMERIC(10,2) DEFAULT 0,
  birdie_pool_per_birdie  NUMERIC(10,2) DEFAULT 0,
  birdie_pool_entrants    INTEGER DEFAULT 0,
  birdie_pool_total_birdies INTEGER DEFAULT 0,

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (adhoc_game_id)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_wwb_results_game ON wwb_results(adhoc_game_id);
CREATE INDEX IF NOT EXISTS idx_wwb_results_club ON wwb_results(club_id, game_date);
CREATE INDEX IF NOT EXISTS idx_pairings_wwb_ww ON pairings(wwb_ww) WHERE wwb_ww = true;
CREATE INDEX IF NOT EXISTS idx_pairings_wwb_birdie ON pairings(wwb_birdie) WHERE wwb_birdie = true;
CREATE INDEX IF NOT EXISTS idx_pairings_captain ON pairings(is_fourball_captain) WHERE is_fourball_captain = true;

-- 5. RLS policies for wwb_results
ALTER TABLE wwb_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wwb_results_select" ON wwb_results
  FOR SELECT USING (true);

CREATE POLICY "wwb_results_insert" ON wwb_results
  FOR INSERT WITH CHECK (true);

CREATE POLICY "wwb_results_update" ON wwb_results
  FOR UPDATE USING (true);
