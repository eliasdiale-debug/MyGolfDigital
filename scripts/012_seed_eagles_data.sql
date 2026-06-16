-- Seed Eagles data
-- Based on the eagles spreadsheet data

INSERT INTO eagles (record_id, member_id, course_id, game_date, eagle_count)
SELECT 
  pr.record_id,
  m.member_id,
  c.course_id,
  pr.game_date,
  1 as eagle_count
FROM members m
CROSS JOIN courses c
CROSS JOIN performance_records pr
WHERE pr.member_id = m.member_id 
  AND pr.course_id = c.course_id
  AND (
    -- Basil Mukwevho - 2 eagles
    (m.member_name = 'Basil Mukwevho' AND c.course_name = 'Pecanwood' AND pr.game_date = '2025-09-26') OR
    (m.member_name = 'Basil Mukwevho' AND c.course_name = 'Waterkloof' AND pr.game_date = '2026-01-09') OR
    -- Oupa Ramaswiela - 3 eagles
    (m.member_name = 'Oupa Ramaswiela' AND c.course_name = 'Copperleaf' AND pr.game_date = '2024-12-15') OR
    (m.member_name = 'Oupa Ramaswiela' AND c.course_name = 'Euphoria' AND pr.game_date = '2025-05-30') OR
    (m.member_name = 'Oupa Ramaswiela' AND c.course_name = 'Waterkloof' AND pr.game_date = '2026-01-04') OR
    -- Thato Mahlamvu - 2 eagles
    (m.member_name = 'Thato Mahlamvu' AND c.course_name = 'CCJ Woodmead' AND pr.game_date = '2024-12-27') OR
    (m.member_name = 'Thato Mahlamvu' AND c.course_name = 'Houghton' AND pr.game_date = '2025-01-26') OR
    -- Reynold Ngobese - 2 eagles
    (m.member_name = 'Reynold Ngobese' AND c.course_name = 'Huddle Park' AND pr.game_date = '2025-02-09') OR
    (m.member_name = 'Reynold Ngobese' AND c.course_name = 'Centurion' AND pr.game_date = '2025-10-26') OR
    -- Bheki Mthethwa - 1 eagle
    (m.member_name = 'Bheki Mthethwa' AND c.course_name = 'CCJ Woodmead' AND pr.game_date = '2024-12-27') OR
    -- Hlengani Mathebula - 1 eagle
    (m.member_name = 'Hlengani Mathebula' AND c.course_name = 'Wanderers' AND pr.game_date = '2025-09-25') OR
    -- Avhashoni Ramikosi - 1 eagle
    (m.member_name = 'Avhashoni Ramikosi' AND c.course_name = 'Reading' AND pr.game_date = '2025-10-19') OR
    -- Elias Diale - 1 eagle
    (m.member_name = 'Elias Diale' AND c.course_name = 'Centurion' AND pr.game_date = '2025-10-26') OR
    -- Livhu Magidimisa - 1 eagle
    (m.member_name = 'Livhu Magidimisa' AND c.course_name = 'Wanderers' AND pr.game_date = '2025-11-14')
  )
ON CONFLICT (record_id, member_id, course_id, game_date) DO NOTHING;
