-- Create Ladies table
-- Tracks ladies (double bogeys or worse on par 3s) for members across different courses

CREATE TABLE IF NOT EXISTS ladies (
  lady_id SERIAL PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES performance_records(record_id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  ladies_count INTEGER NOT NULL DEFAULT 1 CHECK (ladies_count > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_id, member_id, course_id, game_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ladies_member ON ladies(member_id);
CREATE INDEX IF NOT EXISTS idx_ladies_course ON ladies(course_id);
CREATE INDEX IF NOT EXISTS idx_ladies_record ON ladies(record_id);
CREATE INDEX IF NOT EXISTS idx_ladies_date ON ladies(game_date);

-- Create ladies leaderboard view
CREATE OR REPLACE VIEW ladies_leaderboard AS
SELECT 
  m.member_id,
  m.member_name,
  SUM(l.ladies_count) as total_ladies,
  COUNT(DISTINCT l.record_id) as games_with_ladies,
  ROUND(SUM(l.ladies_count)::NUMERIC / COUNT(DISTINCT l.record_id), 2) as avg_ladies_per_game,
  ROW_NUMBER() OVER (ORDER BY SUM(l.ladies_count) DESC) as rank
FROM ladies l
JOIN members m ON l.member_id = m.member_id
GROUP BY m.member_id, m.member_name
ORDER BY total_ladies DESC, m.member_name;
