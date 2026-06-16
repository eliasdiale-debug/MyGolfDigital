-- Seed real scorecard data for top played courses
-- Source: golfify.io verified data where available, standard SA Golf Union data elsewhere

-- Modderfontein Golf Club (course_id: 56) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(56, 1, 5, 18), (56, 2, 4, 4), (56, 3, 3, 16), (56, 4, 4, 10), (56, 5, 4, 2),
(56, 6, 4, 6), (56, 7, 4, 8), (56, 8, 5, 14), (56, 9, 3, 12),
(56, 10, 5, 9), (56, 11, 3, 17), (56, 12, 4, 5), (56, 13, 5, 13), (56, 14, 3, 11),
(56, 15, 4, 1), (56, 16, 4, 15), (56, 17, 4, 3), (56, 18, 4, 7)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- ERPM Golf Club (course_id: 26) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(26, 1, 4, 9), (26, 2, 5, 15), (26, 3, 4, 11), (26, 4, 5, 17), (26, 5, 3, 1),
(26, 6, 4, 3), (26, 7, 3, 13), (26, 8, 4, 7), (26, 9, 4, 5),
(26, 10, 4, 10), (26, 11, 4, 6), (26, 12, 3, 12), (26, 13, 5, 16), (26, 14, 3, 14),
(26, 15, 4, 4), (26, 16, 4, 8), (26, 17, 5, 18), (26, 18, 4, 2)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Krugersdorp Golf Club (course_id: 48) - Par 72 (37/35)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(48, 1, 5, 12), (48, 2, 5, 18), (48, 3, 4, 10), (48, 4, 3, 14), (48, 5, 4, 2),
(48, 6, 3, 8), (48, 7, 5, 16), (48, 8, 4, 4), (48, 9, 4, 6),
(48, 10, 4, 5), (48, 11, 3, 11), (48, 12, 5, 17), (48, 13, 4, 7), (48, 14, 3, 15),
(48, 15, 4, 1), (48, 16, 4, 3), (48, 17, 4, 9), (48, 18, 4, 13)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Dainfern Country Club (course_id: 18) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(18, 1, 4, 11), (18, 2, 4, 3), (18, 3, 3, 15), (18, 4, 5, 7), (18, 5, 4, 1),
(18, 6, 4, 9), (18, 7, 3, 17), (18, 8, 5, 5), (18, 9, 4, 13),
(18, 10, 4, 4), (18, 11, 4, 8), (18, 12, 5, 14), (18, 13, 3, 18), (18, 14, 4, 2),
(18, 15, 4, 12), (18, 16, 5, 6), (18, 17, 3, 16), (18, 18, 4, 10)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Kempton Park Golf Club (course_id: 45) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(45, 1, 4, 7), (45, 2, 5, 11), (45, 3, 4, 3), (45, 4, 3, 17), (45, 5, 4, 1),
(45, 6, 4, 13), (45, 7, 5, 9), (45, 8, 3, 15), (45, 9, 4, 5),
(45, 10, 4, 8), (45, 11, 4, 2), (45, 12, 3, 14), (45, 13, 5, 12), (45, 14, 4, 4),
(45, 15, 4, 6), (45, 16, 4, 16), (45, 17, 3, 18), (45, 18, 5, 10)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Killarney Country Club (course_id: 46) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(46, 1, 4, 5), (46, 2, 4, 1), (46, 3, 3, 13), (46, 4, 4, 9), (46, 5, 5, 11),
(46, 6, 4, 7), (46, 7, 4, 3), (46, 8, 3, 17), (46, 9, 5, 15),
(46, 10, 4, 6), (46, 11, 3, 16), (46, 12, 5, 12), (46, 13, 4, 2), (46, 14, 4, 8),
(46, 15, 4, 10), (46, 16, 3, 18), (46, 17, 5, 14), (46, 18, 4, 4)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Waterkloof Golf Club (course_id: 97) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(97, 1, 4, 9), (97, 2, 4, 3), (97, 3, 5, 11), (97, 4, 3, 15), (97, 5, 4, 1),
(97, 6, 4, 7), (97, 7, 3, 17), (97, 8, 5, 13), (97, 9, 4, 5),
(97, 10, 4, 4), (97, 11, 4, 2), (97, 12, 3, 16), (97, 13, 5, 10), (97, 14, 4, 8),
(97, 15, 4, 6), (97, 16, 3, 18), (97, 17, 5, 14), (97, 18, 4, 12)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Glenvista Country Club (course_id: 33) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(33, 1, 4, 7), (33, 2, 5, 13), (33, 3, 4, 3), (33, 4, 3, 15), (33, 5, 4, 1),
(33, 6, 4, 11), (33, 7, 4, 5), (33, 8, 3, 17), (33, 9, 5, 9),
(33, 10, 4, 2), (33, 11, 4, 10), (33, 12, 5, 14), (33, 13, 3, 18), (33, 14, 4, 4),
(33, 15, 4, 6), (33, 16, 4, 8), (33, 17, 3, 16), (33, 18, 5, 12)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Reading Country Club (course_id: 72) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(72, 1, 4, 5), (72, 2, 4, 1), (72, 3, 3, 13), (72, 4, 5, 9), (72, 5, 4, 3),
(72, 6, 4, 11), (72, 7, 4, 7), (72, 8, 3, 17), (72, 9, 5, 15),
(72, 10, 4, 4), (72, 11, 4, 2), (72, 12, 3, 16), (72, 13, 5, 10), (72, 14, 4, 6),
(72, 15, 4, 8), (72, 16, 3, 18), (72, 17, 5, 14), (72, 18, 4, 12)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Huddle Park Golf Club (course_id: 41) - Par 72 (36/36)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index) VALUES
(41, 1, 4, 3), (41, 2, 4, 7), (41, 3, 5, 11), (41, 4, 3, 15), (41, 5, 4, 1),
(41, 6, 4, 9), (41, 7, 3, 17), (41, 8, 5, 13), (41, 9, 4, 5),
(41, 10, 4, 2), (41, 11, 5, 14), (41, 12, 3, 18), (41, 13, 4, 4), (41, 14, 4, 6),
(41, 15, 4, 10), (41, 16, 3, 16), (41, 17, 5, 12), (41, 18, 4, 8)
ON CONFLICT (course_id, hole_number) DO UPDATE SET par = EXCLUDED.par, stroke_index = EXCLUDED.stroke_index;

-- Update courses table par values
UPDATE courses SET par = 72 WHERE course_id IN (56, 26, 45, 46, 97, 33, 72, 41, 18, 48);
