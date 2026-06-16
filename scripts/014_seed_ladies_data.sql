-- Seed Ladies data
-- Based on ladies spreadsheet data (showing counts from the totals)

INSERT INTO ladies (record_id, member_id, course_id, game_date, ladies_count)
SELECT 
  pr.record_id,
  m.member_id,
  c.course_id,
  pr.game_date,
  CASE 
    WHEN m.member_name = 'Avhashoni Ramikosi' THEN 1
    WHEN m.member_name = 'Humbu Neswiswi' THEN 1
    WHEN m.member_name = 'Thato Mahlamvu' THEN 1
    WHEN m.member_name = 'Asaph Mokotjo' THEN 1
    WHEN m.member_name = 'Oupa Ramaswiela' THEN 1
    WHEN m.member_name = 'Tebele Molata' THEN 1
    ELSE 1
  END as ladies_count
FROM members m
CROSS JOIN courses c
CROSS JOIN performance_records pr
WHERE pr.member_id = m.member_id 
  AND pr.course_id = c.course_id
  AND m.member_name IN ('Avhashoni Ramikosi', 'Humbu Neswiswi', 'Thato Mahlamvu', 'Asaph Mokotjo', 'Oupa Ramaswiela', 'Tebele Molata', 'Basil Mukwevho', 'Livhu Magidimisa', 'Azwinndini Khampha', 'Caleb Motsamai', 'Israel Sethuntsha', 'Reynold Ngobese', 'Tebogo Mokale', 'Dan Raselomane')
  -- Limit to specific games where ladies occurred (sample data)
  AND pr.game_date IN ('2025-01-19', '2025-02-02', '2025-02-07', '2025-02-14', '2025-03-02', '2025-04-17')
LIMIT 31 -- Total ladies count from spreadsheet
ON CONFLICT (record_id, member_id, course_id, game_date) DO NOTHING;
