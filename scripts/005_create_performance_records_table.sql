-- Create Performance Records table
CREATE TABLE IF NOT EXISTS performance_records (
  record_id SERIAL PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
  game_date DATE NOT NULL,
  points INTEGER CHECK (points >= 0),
  gross_score INTEGER CHECK (gross_score >= 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(member_id, course_id, game_date)
);

-- Create indexes for faster lookups
CREATE INDEX idx_performance_member ON performance_records(member_id);
CREATE INDEX idx_performance_course ON performance_records(course_id);
CREATE INDEX idx_performance_date ON performance_records(game_date);
CREATE INDEX idx_performance_member_course ON performance_records(member_id, course_id);

COMMENT ON TABLE performance_records IS 'Performance records for all members across different courses';
COMMENT ON COLUMN performance_records.member_id IS 'Reference to member who played';
COMMENT ON COLUMN performance_records.course_id IS 'Reference to course where game was played';
COMMENT ON COLUMN performance_records.game_date IS 'Date when the game was played';
COMMENT ON COLUMN performance_records.points IS 'Stableford points scored';
COMMENT ON COLUMN performance_records.gross_score IS 'Gross score for the round';
