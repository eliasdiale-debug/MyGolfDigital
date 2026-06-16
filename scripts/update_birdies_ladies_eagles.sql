-- Migration: Update birdies, ladies, eagles for games after State Mines (Feb 22, 2026)
-- For ReMmoho Golf Club (club_id = 1)

-- Delete existing records for games after State Mines to avoid duplicates
DELETE FROM birdies WHERE record_id IN (
  SELECT pr.record_id FROM performance_records pr
  JOIN adhoc_games ag ON pr.course_id = ag.course_id AND pr.game_date = ag.game_date
  WHERE ag.club_id = 1 AND ag.game_date > '2026-02-22'
);

DELETE FROM ladies WHERE record_id IN (
  SELECT pr.record_id FROM performance_records pr
  JOIN adhoc_games ag ON pr.course_id = ag.course_id AND pr.game_date = ag.game_date
  WHERE ag.club_id = 1 AND ag.game_date > '2026-02-22'
);

DELETE FROM eagles WHERE record_id IN (
  SELECT pr.record_id FROM performance_records pr
  JOIN adhoc_games ag ON pr.course_id = ag.course_id AND pr.game_date = ag.game_date
  WHERE ag.club_id = 1 AND ag.game_date > '2026-02-22'
);

-- Insert birdies from pairings data
INSERT INTO birdies (member_id, course_id, record_id, game_date, birdie_count, created_at)
SELECT 
  p.member_id,
  ag.course_id,
  pr.record_id,
  ag.game_date,
  p.birdies_count,
  NOW()
FROM pairings p
JOIN adhoc_games ag ON p.adhoc_game_id = ag.adhoc_game_id
JOIN performance_records pr ON p.member_id = pr.member_id AND ag.game_date = pr.game_date
WHERE ag.club_id = 1 
  AND ag.game_date > '2026-02-22'
  AND p.birdies_count > 0
  AND p.member_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert ladies from pairings data
INSERT INTO ladies (member_id, course_id, record_id, game_date, ladies_count, created_at, updated_at)
SELECT 
  p.member_id,
  ag.course_id,
  pr.record_id,
  ag.game_date,
  p.ladies_count,
  NOW(),
  NOW()
FROM pairings p
JOIN adhoc_games ag ON p.adhoc_game_id = ag.adhoc_game_id
JOIN performance_records pr ON p.member_id = pr.member_id AND ag.game_date = pr.game_date
WHERE ag.club_id = 1 
  AND ag.game_date > '2026-02-22'
  AND p.ladies_count > 0
  AND p.member_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Insert eagles from pairings data
INSERT INTO eagles (member_id, course_id, record_id, game_date, eagle_count, created_at, updated_at)
SELECT 
  p.member_id,
  ag.course_id,
  pr.record_id,
  ag.game_date,
  p.eagles_count,
  NOW(),
  NOW()
FROM pairings p
JOIN adhoc_games ag ON p.adhoc_game_id = ag.adhoc_game_id
JOIN performance_records pr ON p.member_id = pr.member_id AND ag.game_date = pr.game_date
WHERE ag.club_id = 1 
  AND ag.game_date > '2026-02-22'
  AND p.eagles_count > 0
  AND p.member_id IS NOT NULL
ON CONFLICT DO NOTHING;
