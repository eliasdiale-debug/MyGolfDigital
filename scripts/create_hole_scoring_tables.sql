-- course_holes: stores par and stroke index for each hole of each course
CREATE TABLE IF NOT EXISTS course_holes (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(course_id),
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INTEGER NOT NULL DEFAULT 4 CHECK (par BETWEEN 3 AND 5),
  stroke_index INTEGER NOT NULL CHECK (stroke_index BETWEEN 1 AND 18),
  UNIQUE (course_id, hole_number)
);

-- hole_scores: stores individual hole strokes per player per game
CREATE TABLE IF NOT EXISTS hole_scores (
  id SERIAL PRIMARY KEY,
  pairing_id INTEGER NOT NULL REFERENCES pairings(pairing_id),
  adhoc_game_id INTEGER NOT NULL,
  member_id INTEGER NOT NULL REFERENCES members(member_id),
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INTEGER CHECK (strokes BETWEEN 1 AND 15),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (pairing_id, hole_number)
);

CREATE INDEX IF NOT EXISTS idx_hole_scores_pairing ON hole_scores(pairing_id);
CREATE INDEX IF NOT EXISTS idx_hole_scores_game ON hole_scores(adhoc_game_id);
CREATE INDEX IF NOT EXISTS idx_hole_scores_member ON hole_scores(member_id);
CREATE INDEX IF NOT EXISTS idx_course_holes_course ON course_holes(course_id);

-- RLS policies
ALTER TABLE course_holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hole_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to course_holes" ON course_holes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to hole_scores" ON hole_scores FOR ALL USING (true) WITH CHECK (true);

-- Seed Akasia (course_id=1) with standard par-72 layout
-- Typical Akasia CC layout: Par 72
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
  (1, 1, 4, 7),
  (1, 2, 4, 11),
  (1, 3, 3, 15),
  (1, 4, 5, 1),
  (1, 5, 4, 5),
  (1, 6, 4, 9),
  (1, 7, 3, 17),
  (1, 8, 4, 3),
  (1, 9, 5, 13),
  (1, 10, 4, 8),
  (1, 11, 4, 12),
  (1, 12, 3, 16),
  (1, 13, 5, 2),
  (1, 14, 4, 6),
  (1, 15, 4, 10),
  (1, 16, 3, 18),
  (1, 17, 4, 4),
  (1, 18, 5, 14)
ON CONFLICT (course_id, hole_number) DO NOTHING;

-- Update courses par
UPDATE courses SET par = 72 WHERE course_id = 1;
