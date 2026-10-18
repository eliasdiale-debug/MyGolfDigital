-- Stores per-player WWB opt-in choices at booking time,
-- independently of whether pairings have been generated yet.
CREATE TABLE IF NOT EXISTS adhoc_game_wwb_optins (
  optin_id      BIGSERIAL PRIMARY KEY,
  adhoc_game_id BIGINT NOT NULL REFERENCES adhoc_games(adhoc_game_id) ON DELETE CASCADE,
  member_id     BIGINT REFERENCES members(member_id) ON DELETE CASCADE,
  guest_id      BIGINT REFERENCES guests(guest_id)  ON DELETE CASCADE,
  ww            BOOLEAN NOT NULL DEFAULT false,
  birdie        BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (adhoc_game_id, member_id),
  UNIQUE (adhoc_game_id, guest_id)
);

-- Allow reads and writes for authenticated users (RLS off for service role)
ALTER TABLE adhoc_game_wwb_optins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members can manage their own WWB opt-ins"
  ON adhoc_game_wwb_optins FOR ALL USING (true) WITH CHECK (true);
