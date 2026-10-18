-- Create Eagles table
-- Tracks eagle statistics for members across different courses

CREATE TABLE IF NOT EXISTS eagles (
  eagle_id SERIAL PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES performance_records(record_id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  eagle_count INTEGER NOT NULL DEFAULT 1 CHECK (eagle_count > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_id, member_id, course_id, game_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_eagles_member ON eagles(member_id);
CREATE INDEX IF NOT EXISTS idx_eagles_course ON eagles(course_id);
CREATE INDEX IF NOT EXISTS idx_eagles_record ON eagles(record_id);
CREATE INDEX IF NOT EXISTS idx_eagles_date ON eagles(game_date);

-- Create eagles leaderboard view
CREATE OR REPLACE VIEW eagles_leaderboard AS
SELECT 
  m.member_id,
  m.member_name,
  SUM(e.eagle_count) as total_eagles,
  COUNT(DISTINCT e.record_id) as games_with_eagles,
  ROUND(SUM(e.eagle_count)::NUMERIC / COUNT(DISTINCT e.record_id), 2) as avg_eagles_per_game,
  ROW_NUMBER() OVER (ORDER BY SUM(e.eagle_count) DESC) as rank
FROM eagles e
JOIN members m ON e.member_id = m.member_id
GROUP BY m.member_id, m.member_name
ORDER BY total_eagles DESC, m.member_name;
