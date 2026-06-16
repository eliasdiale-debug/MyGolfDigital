-- Seed Performance Records table with all game data
-- Only inserting records where points > 0 (actual games played)

INSERT INTO performance_records (member_id, course_id, game_date, points, gross_score) VALUES
-- Asaph Mokotjo
(1, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 35, 89),
(1, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 29, 95),
(1, (SELECT course_id FROM courses WHERE course_name = 'Copperleaf'), '2025-12-31', 30, 93),
(1, (SELECT course_id FROM courses WHERE course_name = 'Services'), '2026-01-11', 31, 93),

-- Avhashoni Ramikosi
(2, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 26, 95),
(2, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 36, 87),
(2, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 28, 96),
(2, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 36, 87),
(2, (SELECT course_id FROM courses WHERE course_name = 'Kyalami'), '2026-01-02', 27, 97),
(2, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 29, 94),
(2, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 31, 92),

-- Azwinndini Khampha
(3, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 29, 92),
(3, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 28, 92),
(3, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 20, 103),
(3, (SELECT course_id FROM courses WHERE course_name = 'Kyalami'), '2026-01-02', 30, 94),
(3, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 26, 97),
(3, (SELECT course_id FROM courses WHERE course_name = 'Gary Player'), '2026-01-07', 26, 97),
(3, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 21, 102),
(3, (SELECT course_id FROM courses WHERE course_name = 'Services'), '2026-01-11', 30, 92),

-- Basil Mukwevho
(4, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 44, 75),
(4, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 25, 93),
(4, (SELECT course_id FROM courses WHERE course_name = 'Kyalami'), '2026-01-02', 31, 86),
(4, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 30, 86),
(4, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 27, 89),
(4, (SELECT course_id FROM courses WHERE course_name = 'Services'), '2026-01-11', 32, 83),

-- Bheki Mthethwa
(5, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 25, 87),

-- Caleb Motsamai
(7, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 22, 102),
(7, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 32, 93),
(7, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 21, 105),

-- Dan Raselomane
(8, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 30, 89),
(8, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 32, 88),
(8, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 37, 83),
(8, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 33, 87),
(8, (SELECT course_id FROM courses WHERE course_name = 'Stellenbosch'), '2025-12-18', 28, 92),
(8, (SELECT course_id FROM courses WHERE course_name = 'Steenberg'), '2025-12-19', 32, 87),
(8, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 34, 87),
(8, (SELECT course_id FROM courses WHERE course_name = 'Services'), '2026-01-11', 32, 89),

-- Elias Diale
(9, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 32, 82),
(9, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 40, 75),
(9, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 34, 81),
(9, (SELECT course_id FROM courses WHERE course_name = 'Kempton Park'), '2025-12-23', 34, 80),
(9, (SELECT course_id FROM courses WHERE course_name = 'Copperleaf'), '2025-12-31', 30, 83),
(9, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 23, 91),

-- Hlengani Mathebula
(10, (SELECT course_id FROM courses WHERE course_name = 'Gary Player'), '2026-01-07', 28, 96),

-- Humbu Neswiswi
(11, (SELECT course_id FROM courses WHERE course_name = 'Gary Player'), '2026-01-07', 16, 110),

-- Israel Sethuntsha
(12, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 31, 93),
(12, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 24, 100),

-- Joe Ralebepa
(13, (SELECT course_id FROM courses WHERE course_name = 'Kyalami'), '2026-01-02', 24, 102),

-- Kgotso Lebotsa
(15, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 19, 107),

-- Livhu Magidimisa
(17, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 24, 91),
(17, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 30, 85),
(17, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 35, 82),
(17, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 31, 86),
(17, (SELECT course_id FROM courses WHERE course_name = 'Kempton Park'), '2025-12-23', 31, 86),
(17, (SELECT course_id FROM courses WHERE course_name = 'Copperleaf'), '2025-12-31', 31, 85),
(17, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 28, 90),

-- Mandla Mthethwa
(19, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 31, 84),
(19, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 38, 77),
(19, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 27, 87),

-- Moeketsi Seboko
(23, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 29, 97),

-- Naph Nteo
(26, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 28, 95),
(26, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 33, 91),
(26, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 35, 90),
(26, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 35, 90),
(26, (SELECT course_id FROM courses WHERE course_name = 'Kempton Park'), '2025-12-23', 32, 93),
(26, (SELECT course_id FROM courses WHERE course_name = 'Kyalami'), '2026-01-02', 35, 91),
(26, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 28, 97),
(26, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 27, 97),

-- Nthumeni Wanga
(27, (SELECT course_id FROM courses WHERE course_name = 'Gary Player'), '2026-01-07', 30, 91),

-- Oupa Ramaswiela
(28, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 32, 87),
(28, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 32, 88),
(28, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 25, 95),
(28, (SELECT course_id FROM courses WHERE course_name = 'Gary Player'), '2026-01-07', 23, 98),
(28, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 33, 88),

-- Raymond Ndou
(29, (SELECT course_id FROM courses WHERE course_name = 'Gary Player'), '2026-01-07', 25, 97),

-- Reynold Ngobese
(30, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 29, 89),
(30, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 40, 79),
(30, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 34, 85),
(30, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 31, 88),
(30, (SELECT course_id FROM courses WHERE course_name = 'Kyalami'), '2026-01-02', 27, 92),

-- Sabatta Tsotetsi
(31, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 30, 88),
(31, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 31, 89),
(31, (SELECT course_id FROM courses WHERE course_name = 'Stellenbosch'), '2025-12-18', 32, 86),
(31, (SELECT course_id FROM courses WHERE course_name = 'Steenberg'), '2025-12-19', 30, 89),
(31, (SELECT course_id FROM courses WHERE course_name = 'Services'), '2026-01-11', 33, 88),

-- Sekete Mokgehle
(32, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 34, 92),
(32, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 28, 97),

-- Solly Mlondobozi
(34, (SELECT course_id FROM courses WHERE course_name = 'Killarney'), '2025-12-05', 34, 86),
(34, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 25, 94),
(34, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 35, 86),
(34, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 28, 93),

-- Sydney Mhlarhi
(36, (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), '2025-12-07', 25, 97),
(36, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 32, 94),
(36, (SELECT course_id FROM courses WHERE course_name = 'Steenberg'), '2025-12-19', 37, 87),
(36, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 33, 93),

-- Tebele Molata
(37, (SELECT course_id FROM courses WHERE course_name = 'Reading'), '2025-12-14', 37, 85),
(37, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 34, 87),
(37, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 33, 88),

-- Tebogo Mokale
(38, (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), '2025-12-12', 32, 89),
(38, (SELECT course_id FROM courses WHERE course_name = 'Kempton Park'), '2025-12-23', 36, 86),
(38, (SELECT course_id FROM courses WHERE course_name = 'Glenvista'), '2026-01-04', 23, 99),

-- Thato Mahlamvu
(40, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 33, 88),
(40, (SELECT course_id FROM courses WHERE course_name = 'Copperleaf'), '2025-12-31', 30, 89),
(40, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 36, 84),

-- Tsepo Lepono
(41, (SELECT course_id FROM courses WHERE course_name = 'Modderfontein'), '2025-12-16', 31, 93),
(41, (SELECT course_id FROM courses WHERE course_name = 'Stellenbosch'), '2025-12-18', 33, 89),
(41, (SELECT course_id FROM courses WHERE course_name = 'Steenberg'), '2025-12-19', 27, 94),
(41, (SELECT course_id FROM courses WHERE course_name = 'Waterkloof'), '2026-01-09', 27, 101)

ON CONFLICT (member_id, course_id, game_date) DO NOTHING;
