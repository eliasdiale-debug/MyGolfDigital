-- Create iron_man_competitions table to track multi-game competitions
CREATE TABLE IF NOT EXISTS iron_man_competitions (
  competition_id SERIAL PRIMARY KEY,
  competition_name VARCHAR(255) NOT NULL,
  club_id INTEGER NOT NULL REFERENCES golf_clubs(club_id),
  game_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competition_name, club_id, game_date)
);

-- Create iron_man_games junction table to link games to competitions
CREATE TABLE IF NOT EXISTS iron_man_games (
  iron_man_game_id SERIAL PRIMARY KEY,
  competition_id INTEGER NOT NULL REFERENCES iron_man_competitions(competition_id),
  adhoc_game_id INTEGER NOT NULL REFERENCES adhoc_games(adhoc_game_id),
  game_order INTEGER NOT NULL, -- 1 for first game, 2 for second game
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competition_id, adhoc_game_id)
);

-- Create iron_man_leaderboard view to show cumulative scores
CREATE OR REPLACE VIEW iron_man_leaderboard AS
SELECT 
  imc.competition_id,
  imc.competition_name,
  imc.club_id,
  imc.game_date,
  m.member_id,
  m.member_name,
  SUM(dr.points) as total_points,
  COUNT(DISTINCT ig.game_order) as games_played,
  MAX(CASE WHEN ig.game_order = 1 THEN dr.points END) as game1_points,
  MAX(CASE WHEN ig.game_order = 2 THEN dr.points END) as game2_points,
  ROW_NUMBER() OVER (PARTITION BY imc.competition_id ORDER BY SUM(dr.points) DESC) as position
FROM iron_man_competitions imc
JOIN iron_man_games ig ON imc.competition_id = ig.competition_id
JOIN adhoc_games ag ON ig.adhoc_game_id = ag.adhoc_game_id
JOIN day_results dr ON ag.adhoc_game_id = (
  SELECT adhoc_game_id FROM adhoc_games WHERE game_date = dr.game_date
)
JOIN members m ON dr.member_id = m.member_id
WHERE dr.game_date = imc.game_date
  AND m.club_id = imc.club_id
GROUP BY imc.competition_id, imc.competition_name, imc.club_id, imc.game_date, m.member_id, m.member_name
ORDER BY imc.competition_id, total_points DESC;
