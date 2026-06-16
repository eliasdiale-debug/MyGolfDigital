-- Seed Late Arrivals data
-- Based on late arrivals spreadsheet data

INSERT INTO late_arrivals (record_id, member_id, course_id, game_date, was_late)
SELECT 
  pr.record_id,
  m.member_id,
  c.course_id,
  pr.game_date,
  true as was_late
FROM members m
CROSS JOIN courses c
CROSS JOIN performance_records pr
WHERE pr.member_id = m.member_id 
  AND pr.course_id = c.course_id
  AND (
    -- Livhu Magidimisa - 3 late arrivals
    (m.member_name = 'Livhu Magidimisa' AND c.course_name = 'Dainfern' AND pr.game_date = '2025-04-19') OR
    (m.member_name = 'Livhu Magidimisa' AND c.course_name = 'Euphoria' AND pr.game_date = '2025-05-30') OR
    (m.member_name = 'Livhu Magidimisa' AND c.course_name = 'Houghton' AND pr.game_date = '2025-11-12') OR
    -- Israel Sethuntsha - 1 late arrival
    (m.member_name = 'Israel Sethuntsha' AND c.course_name = 'Bryanston' AND pr.game_date = '2025-03-02') OR
    -- Azwinndini Khampha - 1 late arrival
    (m.member_name = 'Azwinndini Khampha' AND c.course_name = 'Kyalami' AND pr.game_date = '2025-10-24')
  )
ON CONFLICT (record_id, member_id, course_id, game_date) DO NOTHING;
