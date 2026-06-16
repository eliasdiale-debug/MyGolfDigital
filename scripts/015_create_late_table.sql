-- Create Late table
-- Tracks late arrivals for members at different courses

CREATE TABLE IF NOT EXISTS late_arrivals (
  late_id SERIAL PRIMARY KEY,
  record_id INTEGER NOT NULL REFERENCES performance_records(record_id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  was_late BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(record_id, member_id, course_id, game_date)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_late_member ON late_arrivals(member_id);
CREATE INDEX IF NOT EXISTS idx_late_course ON late_arrivals(course_id);
CREATE INDEX IF NOT EXISTS idx_late_record ON late_arrivals(record_id);
CREATE INDEX IF NOT EXISTS idx_late_date ON late_arrivals(game_date);

-- Create late arrivals leaderboard view
CREATE OR REPLACE VIEW late_arrivals_leaderboard AS
SELECT 
  m.member_id,
  m.member_name,
  COUNT(*) as total_late_arrivals,
  COUNT(DISTINCT l.course_id) as courses_late_at,
  ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rank
FROM late_arrivals l
JOIN members m ON l.member_id = m.member_id
WHERE l.was_late = true
GROUP BY m.member_id, m.member_name
ORDER BY total_late_arrivals DESC, m.member_name;
