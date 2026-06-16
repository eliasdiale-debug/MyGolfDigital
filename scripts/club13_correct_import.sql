-- Club 13 (WSOE / Wednesday School) - Correct Past Games Import
-- Only players with actual Points in each game are included
-- Gross = par + playing_handicap - (points - 36)
-- pairings has: playing_handicap, points, gross_score, fourball_number, is_captain, result_submitted, scores_submitted_at
-- performance_records has: member_id, course_id, game_date, points, gross_score, club_id (no playing_handicap col)

DO $$
DECLARE
  g1 INT; g2 INT; g3 INT; g4 INT; g5 INT;
  g6 INT; g7 INT; g8 INT; g9 INT;
BEGIN

INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,69,'2026-01-14','07:00',120,0,'completed','IPS',13,'Imported - PCC') RETURNING adhoc_game_id INTO g1;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,10,'2026-01-21','07:00',120,0,'completed','IPS',13,'Imported - CCJ Rocklands') RETURNING adhoc_game_id INTO g2;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,101,'2026-01-28','07:00',120,0,'completed','IPS',13,'Imported - Woodhill') RETURNING adhoc_game_id INTO g3;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,95,'2026-02-04','07:00',120,0,'completed','IPS',13,'Imported - Wanderers') RETURNING adhoc_game_id INTO g4;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,72,'2026-02-11','07:00',120,0,'completed','IPS',13,'Imported - Reading') RETURNING adhoc_game_id INTO g5;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,49,'2026-02-18','07:00',120,0,'completed','IPS',13,'Imported - Kyalami') RETURNING adhoc_game_id INTO g6;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,12,'2026-02-25','07:00',120,0,'completed','IPS',13,'Imported - CCJ Woodmead') RETURNING adhoc_game_id INTO g7;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,62,'2026-03-04','07:00',120,0,'completed','IPS',13,'Imported - Parkview') RETURNING adhoc_game_id INTO g8;
INSERT INTO adhoc_games (organizer_id,course_id,game_date,tee_off_time,max_players,cost_per_player,status,game_type,club_id,notes)
VALUES (612,13,'2026-03-11','07:00',120,0,'completed','IPS',13,'Imported - Centurion') RETURNING adhoc_game_id INTO g9;

RAISE NOTICE 'Games created: g1=% g2=% g3=% g4=% g5=% g6=% g7=% g8=% g9=%',g1,g2,g3,g4,g5,g6,g7,g8,g9;

-- ── GAME 1: PCC 2026-01-14 par=72 ─────────────────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g1,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,72+hcp-(pts-36),TRUE,'2026-01-14 12:00:00+00'
FROM (VALUES
  (441,30,8),(455,18,14),(467,34,18),(468,34,13),(481,30,11),
  (448,35,13),(494,25,10),(505,36,15),(521,26,17),(522,30,6),
  (543,24,29),(545,35,7),(564,22,19),(588,33,11),(589,33,2),
  (592,28,13),(612,23,16),(619,24,19),(645,30,12),(646,32,6),
  (653,30,12),(654,22,23),(658,24,16),(674,37,7),(688,29,15),
  (700,32,19),(707,30,10),(710,30,15),(712,28,29),(716,32,11),
  (500,27,27),(732,24,6)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,69,'2026-01-14',pts,72+hcp-(pts-36),13
FROM (VALUES
  (441,30,8),(455,18,14),(467,34,18),(468,34,13),(481,30,11),
  (448,35,13),(494,25,10),(505,36,15),(521,26,17),(522,30,6),
  (543,24,29),(545,35,7),(564,22,19),(588,33,11),(589,33,2),
  (592,28,13),(612,23,16),(619,24,19),(645,30,12),(646,32,6),
  (653,30,12),(654,22,23),(658,24,16),(674,37,7),(688,29,15),
  (700,32,19),(707,30,10),(710,30,15),(712,28,29),(716,32,11),
  (500,27,27),(732,24,6)
) AS t(member_id,pts,hcp);

-- ── GAME 2: CCJ Rocklands 2026-01-21 par=72 ──────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g2,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,72+hcp-(pts-36),TRUE,'2026-01-21 12:00:00+00'
FROM (VALUES
  (454,29,1),(468,25,10),(510,23,13),(514,28,9),(518,32,16),
  (521,36,15),(522,26,4),(523,30,16),(527,21,13),(531,25,9),
  (543,20,28),(550,34,9),(551,26,18),(575,30,18),(577,25,10),
  (592,35,11),(594,27,12),(612,32,15),(631,32,9),(639,42,21),
  (645,9,12),(646,27,4),(653,27,10),(658,19,14),(662,23,12),
  (664,32,7),(668,33,7),(674,33,5),(688,26,13),(700,30,17),
  (709,23,12),(710,13,13),(716,28,10),(717,29,13),(719,21,14),
  (725,24,8),(732,31,4)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,10,'2026-01-21',pts,72+hcp-(pts-36),13
FROM (VALUES
  (454,29,1),(468,25,10),(510,23,13),(514,28,9),(518,32,16),
  (521,36,15),(522,26,4),(523,30,16),(527,21,13),(531,25,9),
  (543,20,28),(550,34,9),(551,26,18),(575,30,18),(577,25,10),
  (592,35,11),(594,27,12),(612,32,15),(631,32,9),(639,42,21),
  (645,9,12),(646,27,4),(653,27,10),(658,19,14),(662,23,12),
  (664,32,7),(668,33,7),(674,33,5),(688,26,13),(700,30,17),
  (709,23,12),(710,13,13),(716,28,10),(717,29,13),(719,21,14),
  (725,24,8),(732,31,4)
) AS t(member_id,pts,hcp);

-- ── GAME 3: Woodhill 2026-01-28 par=72 ───────────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g3,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,72+hcp-(pts-36),TRUE,'2026-01-28 12:00:00+00'
FROM (VALUES
  (454,29,1),(468,30,12),(492,24,23),(494,32,10),(510,22,14),
  (518,29,16),(522,32,5),(531,29,10),(543,20,28),(563,31,9),
  (568,23,23),(592,25,11),(594,35,13),(662,35,9),(664,23,8),
  (668,32,8),(674,27,5),(676,37,20),(688,26,14),(700,15,18),
  (709,21,13),(716,31,10),(717,37,14),(719,21,15),(725,24,9),
  (732,25,5)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,101,'2026-01-28',pts,72+hcp-(pts-36),13
FROM (VALUES
  (454,29,1),(468,30,12),(492,24,23),(494,32,10),(510,22,14),
  (518,29,16),(522,32,5),(531,29,10),(543,20,28),(563,31,9),
  (568,23,23),(592,25,11),(594,35,13),(662,35,9),(664,23,8),
  (668,32,8),(674,27,5),(676,37,20),(688,26,14),(700,15,18),
  (709,21,13),(716,31,10),(717,37,14),(719,21,15),(725,24,9),
  (732,25,5)
) AS t(member_id,pts,hcp);

-- ── GAME 4: Wanderers 2026-02-04 par=71 ──────────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g4,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,71+hcp-(pts-36),TRUE,'2026-02-04 12:00:00+00'
FROM (VALUES
  (448,24,10),(451,25,21),(456,37,10),(458,26,6),(492,24,21),
  (493,26,6),(494,33,9),(519,27,12),(522,34,5),(526,26,6),
  (531,29,9),(543,28,28),(550,30,8),(594,34,11),(655,30,7),
  (656,31,8),(658,22,14),(662,31,8),(664,31,6),(674,22,5),
  (686,36,16),(687,24,10),(688,29,13),(689,36,15),(700,21,16),
  (704,21,25),(710,28,13),(717,32,11),(725,20,10)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,95,'2026-02-04',pts,71+hcp-(pts-36),13
FROM (VALUES
  (448,24,10),(451,25,21),(456,37,10),(458,26,6),(492,24,21),
  (493,26,6),(494,33,9),(519,27,12),(522,34,5),(526,26,6),
  (531,29,9),(543,28,28),(550,30,8),(594,34,11),(655,30,7),
  (656,31,8),(658,22,14),(662,31,8),(664,31,6),(674,22,5),
  (686,36,16),(687,24,10),(688,29,13),(689,36,15),(700,21,16),
  (704,21,25),(710,28,13),(717,32,11),(725,20,10)
) AS t(member_id,pts,hcp);

-- ── GAME 5: Reading 2026-02-11 par=71 ────────────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g5,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,71+hcp-(pts-36),TRUE,'2026-02-11 12:00:00+00'
FROM (VALUES
  (449,20,27),(451,26,24),(454,28,2),(456,27,10),(458,27,8),
  (468,31,13),(492,20,25),(493,37,7),(494,32,10),(507,27,15),
  (519,28,14),(522,31,6),(526,26,8),(543,21,26),(550,32,10),
  (594,28,12),(607,28,16),(612,24,14),(619,17,17),(639,29,21),
  (645,28,12),(646,27,6),(651,27,6),(653,27,12),(658,20,17),
  (659,22,19),(662,38,9),(664,27,6),(674,22,5),(686,34,14),
  (687,24,10),(688,27,15),(689,13,15),(700,24,16),(704,21,26),
  (710,32,15),(713,23,20),(716,27,10),(717,24,11),(719,13,13),
  (723,27,20),(725,20,10),(732,36,6)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,72,'2026-02-11',pts,71+hcp-(pts-36),13
FROM (VALUES
  (449,20,27),(451,26,24),(454,28,2),(456,27,10),(458,27,8),
  (468,31,13),(492,20,25),(493,37,7),(494,32,10),(507,27,15),
  (519,28,14),(522,31,6),(526,26,8),(543,21,26),(550,32,10),
  (594,28,12),(607,28,16),(612,24,14),(619,17,17),(639,29,21),
  (645,28,12),(646,27,6),(651,27,6),(653,27,12),(658,20,17),
  (659,22,19),(662,38,9),(664,27,6),(674,22,5),(686,34,14),
  (687,24,10),(688,27,15),(689,13,15),(700,24,16),(704,21,26),
  (710,32,15),(713,23,20),(716,27,10),(717,24,11),(719,13,13),
  (723,27,20),(725,20,10),(732,36,6)
) AS t(member_id,pts,hcp);

-- ── GAME 6: Kyalami 2026-02-18 par=72 ────────────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g6,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,72+hcp-(pts-36),TRUE,'2026-02-18 12:00:00+00'
FROM (VALUES
  (449,20,28),(451,29,25),(454,35,2),(456,27,10),(458,27,8),
  (476,26,12),(492,27,25),(493,27,7),(494,32,10),(497,30,15),
  (501,28,14),(504,24,25),(505,37,15),(519,22,14),(520,31,17),
  (521,28,16),(522,29,6),(523,38,18),(526,26,8),(531,32,10),
  (543,17,29),(548,32,13),(550,32,10),(551,22,20),(575,30,19),
  (576,34,19),(592,34,10),(594,28,13),(596,31,17),(604,26,15),
  (612,24,14),(619,28,19),(631,25,10),(639,29,21),(640,36,14),
  (641,29,1),(645,26,13),(646,29,6),(653,29,12),(658,20,17),
  (662,28,9),(664,27,8),(674,27,7),(688,29,15),(700,24,19),
  (704,26,25),(709,32,14),(710,28,15),(716,27,10),(717,28,14),
  (725,22,10),(732,28,5)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,49,'2026-02-18',pts,72+hcp-(pts-36),13
FROM (VALUES
  (449,20,28),(451,29,25),(454,35,2),(456,27,10),(458,27,8),
  (476,26,12),(492,27,25),(493,27,7),(494,32,10),(497,30,15),
  (501,28,14),(504,24,25),(505,37,15),(519,22,14),(520,31,17),
  (521,28,16),(522,29,6),(523,38,18),(526,26,8),(531,32,10),
  (543,17,29),(548,32,13),(550,32,10),(551,22,20),(575,30,19),
  (576,34,19),(592,34,10),(594,28,13),(596,31,17),(604,26,15),
  (612,24,14),(619,28,19),(631,25,10),(639,29,21),(640,36,14),
  (641,29,1),(645,26,13),(646,29,6),(653,29,12),(658,20,17),
  (662,28,9),(664,27,8),(674,27,7),(688,29,15),(700,24,19),
  (704,26,25),(709,32,14),(710,28,15),(716,27,10),(717,28,14),
  (725,22,10),(732,28,5)
) AS t(member_id,pts,hcp);

-- ── GAME 7: CCJ Woodmead 2026-02-25 par=72 ───────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g7,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,72+hcp-(pts-36),TRUE,'2026-02-25 12:00:00+00'
FROM (VALUES
  (446,29,18),(451,29,24),(454,30,1),(456,32,10),(458,29,8),
  (468,32,13),(474,35,10),(476,26,12),(481,29,11),(492,27,24),
  (493,37,7),(494,34,10),(497,27,15),(501,28,14),(505,37,15),
  (514,26,10),(519,16,14),(520,26,17),(521,28,16),(522,29,6),
  (526,26,8),(531,32,10),(540,34,13),(543,34,29),(548,32,13),
  (550,32,10),(551,22,19),(560,32,13),(576,28,19),(592,38,10),
  (594,32,13),(601,31,14),(604,26,15),(609,6,17),(612,24,14),
  (619,28,19),(625,33,12),(631,25,10),(635,22,9),(640,36,14),
  (645,26,13),(646,36,5),(650,24,15),(653,33,12),(654,27,24),
  (656,38,10),(658,17,18),(662,36,8),(664,28,7),(674,27,7),
  (681,29,7),(688,18,15),(700,30,19),(704,33,25),(709,33,14),
  (710,28,15),(716,25,10),(717,23,10),(725,34,10),(732,34,5)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,12,'2026-02-25',pts,72+hcp-(pts-36),13
FROM (VALUES
  (446,29,18),(451,29,24),(454,30,1),(456,32,10),(458,29,8),
  (468,32,13),(474,35,10),(476,26,12),(481,29,11),(492,27,24),
  (493,37,7),(494,34,10),(497,27,15),(501,28,14),(505,37,15),
  (514,26,10),(519,16,14),(520,26,17),(521,28,16),(522,29,6),
  (526,26,8),(531,32,10),(540,34,13),(543,34,29),(548,32,13),
  (550,32,10),(551,22,19),(560,32,13),(576,28,19),(592,38,10),
  (594,32,13),(601,31,14),(604,26,15),(609,6,17),(612,24,14),
  (619,28,19),(625,33,12),(631,25,10),(635,22,9),(640,36,14),
  (645,26,13),(646,36,5),(650,24,15),(653,33,12),(654,27,24),
  (656,38,10),(658,17,18),(662,36,8),(664,28,7),(674,27,7),
  (681,29,7),(688,18,15),(700,30,19),(704,33,25),(709,33,14),
  (710,28,15),(716,25,10),(717,23,10),(725,34,10),(732,34,5)
) AS t(member_id,pts,hcp);

-- ── GAME 8: Parkview 2026-03-04 par=72 ───────────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g8,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,72+hcp-(pts-36),TRUE,'2026-03-04 12:00:00+00'
FROM (VALUES
  (446,30,18),(447,35,18),(474,35,10),(500,23,25),(508,26,6),
  (510,25,13),(514,26,10),(519,25,13),(522,28,5),(523,28,16),
  (525,37,7),(531,33,10),(543,23,27),(550,35,9),(551,41,18),
  (560,27,12),(574,29,10),(592,34,9),(594,30,12),(601,31,14),
  (609,3,17),(612,22,13),(619,25,19),(631,25,10),(635,22,9),
  (638,35,15),(645,38,12),(646,36,5),(650,24,15),(653,33,11),
  (655,28,8),(658,28,16),(662,34,8),(664,28,7),(674,27,6),
  (681,29,7),(688,18,15),(700,35,18),(704,33,24),(709,25,13),
  (710,30,14),(716,25,10),(717,23,10),(725,34,10),(732,34,5),
  (740,33,13)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,62,'2026-03-04',pts,72+hcp-(pts-36),13
FROM (VALUES
  (446,30,18),(447,35,18),(474,35,10),(500,23,25),(508,26,6),
  (510,25,13),(514,26,10),(519,25,13),(522,28,5),(523,28,16),
  (525,37,7),(531,33,10),(543,23,27),(550,35,9),(551,41,18),
  (560,27,12),(574,29,10),(592,34,9),(594,30,12),(601,31,14),
  (609,3,17),(612,22,13),(619,25,19),(631,25,10),(635,22,9),
  (638,35,15),(645,38,12),(646,36,5),(650,24,15),(653,33,11),
  (655,28,8),(658,28,16),(662,34,8),(664,28,7),(674,27,6),
  (681,29,7),(688,18,15),(700,35,18),(704,33,24),(709,25,13),
  (710,30,14),(716,25,10),(717,23,10),(725,34,10),(732,34,5),
  (740,33,13)
) AS t(member_id,pts,hcp);

-- ── GAME 9: Centurion 2026-03-11 par=71 ──────────────────────────────────
INSERT INTO pairings (adhoc_game_id,member_id,fourball_number,is_captain,points,playing_handicap,gross_score,result_submitted,scores_submitted_at)
SELECT g9,member_id,CEIL(ROW_NUMBER()OVER(ORDER BY hcp)::numeric/4)::int,(ROW_NUMBER()OVER(ORDER BY hcp)-1)%4=0,
  pts,hcp,71+hcp-(pts-36),TRUE,'2026-03-11 12:00:00+00'
FROM (VALUES
  (500,25,23),(505,24,13),(522,29,6),(531,24,10),(543,27,28),
  (550,27,9),(560,25,13),(563,22,10),(592,28,9),(594,34,12),
  (600,29,10),(609,3,18),(612,22,13),(619,28,19),(631,32,10),
  (635,22,9),(638,8,10),(645,27,11),(646,27,5),(650,24,16),
  (653,33,11),(655,30,8),(658,27,17),(662,31,8),(674,31,6),
  (681,29,7),(688,27,15),(700,25,17),(704,28,23),(709,25,13),
  (710,26,12),(716,27,10),(717,33,10),(725,27,10),(732,34,5),
  (740,33,12),(743,29,19),(744,28,10)
) AS t(member_id,pts,hcp);

INSERT INTO performance_records (member_id,course_id,game_date,points,gross_score,club_id)
SELECT member_id,13,'2026-03-11',pts,71+hcp-(pts-36),13
FROM (VALUES
  (500,25,23),(505,24,13),(522,29,6),(531,24,10),(543,27,28),
  (550,27,9),(560,25,13),(563,22,10),(592,28,9),(594,34,12),
  (600,29,10),(609,3,18),(612,22,13),(619,28,19),(631,32,10),
  (635,22,9),(638,8,10),(645,27,11),(646,27,5),(650,24,16),
  (653,33,11),(655,30,8),(658,27,17),(662,31,8),(674,31,6),
  (681,29,7),(688,27,15),(700,25,17),(704,28,23),(709,25,13),
  (710,26,12),(716,27,10),(717,33,10),(725,27,10),(732,34,5),
  (740,33,12),(743,29,19),(744,28,10)
) AS t(member_id,pts,hcp);

RAISE NOTICE 'Club 13 import complete.';
END $$;
