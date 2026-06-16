-- Process Game 33 (Benoni Lake Club, 2026-03-15) into day_results and performance_records

-- Calculate and insert day_results
WITH game_info AS (
  SELECT ag.adhoc_game_id, ag.game_date, ag.course_id, ag.club_id,
         c.par as course_par
  FROM adhoc_games ag
  JOIN courses c ON ag.course_id = c.course_id
  WHERE ag.adhoc_game_id = 33
),
course_pars AS (
  SELECT hole_number, par, stroke_index
  FROM course_holes
  WHERE course_id = 3
),
player_scores AS (
  SELECT 
    hs.member_id,
    p.playing_handicap,
    p.adhoc_game_id,
    SUM(hs.strokes) as gross_score,
    -- Calculate IPS points per hole
    SUM(
      CASE 
        -- If player gets a stroke on this hole (stroke_index <= playing_handicap)
        WHEN cp.stroke_index <= p.playing_handicap THEN
          CASE 
            -- Double bogey or worse with stroke = 0 points
            WHEN hs.strokes >= cp.par + 3 THEN 0
            -- Bogey with stroke (net par) = 2 points
            WHEN hs.strokes = cp.par + 2 THEN 2
            -- Par with stroke (net birdie) = 3 points
            WHEN hs.strokes = cp.par + 1 THEN 3
            -- Birdie with stroke (net eagle) = 4 points
            WHEN hs.strokes = cp.par THEN 4
            -- Eagle with stroke = 5 points
            WHEN hs.strokes = cp.par - 1 THEN 5
            -- Albatross with stroke = 6 points
            WHEN hs.strokes <= cp.par - 2 THEN 6
            ELSE 0
          END
        -- No stroke on this hole
        ELSE
          CASE 
            -- Triple bogey or worse = 0 points
            WHEN hs.strokes >= cp.par + 3 THEN 0
            -- Double bogey = 1 point
            WHEN hs.strokes = cp.par + 2 THEN 1
            -- Bogey = 2 points
            WHEN hs.strokes = cp.par + 1 THEN 2
            -- Par = 3 points
            WHEN hs.strokes = cp.par THEN 3
            -- Birdie = 4 points
            WHEN hs.strokes = cp.par - 1 THEN 4
            -- Eagle = 5 points
            WHEN hs.strokes = cp.par - 2 THEN 5
            -- Albatross or better = 6 points
            WHEN hs.strokes <= cp.par - 3 THEN 6
            ELSE 0
          END
      END
    ) as ips_points,
    -- Count birdies (gross score = par - 1)
    SUM(CASE WHEN hs.strokes = cp.par - 1 THEN 1 ELSE 0 END) as birdies_count,
    -- Count eagles (gross score = par - 2 or better)
    SUM(CASE WHEN hs.strokes <= cp.par - 2 THEN 1 ELSE 0 END) as eagles_count
  FROM hole_scores hs
  JOIN pairings p ON hs.pairing_id = p.pairing_id
  JOIN course_pars cp ON hs.hole_number = cp.hole_number
  WHERE p.adhoc_game_id = 33
  GROUP BY hs.member_id, p.playing_handicap, p.adhoc_game_id
)
INSERT INTO day_results (
  game_date, course_id, member_id, club_id,
  points, gross_score, playing_handicap,
  birdies_count, eagles_count,
  ladies_count, is_late, is_sub,
  no_show_fee, cash_paid, birdie_pool, lady_payout, late_payout, sub_payout,
  total_club, eagle_payout, total_member, debtor_creditor,
  medal_gross, medal_net
)
SELECT 
  gi.game_date,
  gi.course_id,
  ps.member_id,
  gi.club_id,
  ps.ips_points as points,
  ps.gross_score,
  ps.playing_handicap,
  ps.birdies_count,
  ps.eagles_count,
  0 as ladies_count,
  false as is_late,
  false as is_sub,
  0 as no_show_fee,
  0 as cash_paid,
  0 as birdie_pool,
  0 as lady_payout,
  0 as late_payout,
  0 as sub_payout,
  0 as total_club,
  0 as eagle_payout,
  0 as total_member,
  0 as debtor_creditor,
  ps.gross_score as medal_gross,
  ps.gross_score - ps.playing_handicap as medal_net
FROM player_scores ps
CROSS JOIN game_info gi
ON CONFLICT DO NOTHING;

-- Also insert into performance_records
WITH game_info AS (
  SELECT ag.adhoc_game_id, ag.game_date, ag.course_id, ag.club_id
  FROM adhoc_games ag
  WHERE ag.adhoc_game_id = 33
),
course_pars AS (
  SELECT hole_number, par, stroke_index
  FROM course_holes
  WHERE course_id = 3
),
player_scores AS (
  SELECT 
    hs.member_id,
    p.playing_handicap,
    SUM(hs.strokes) as gross_score,
    SUM(
      CASE 
        WHEN cp.stroke_index <= p.playing_handicap THEN
          CASE 
            WHEN hs.strokes >= cp.par + 3 THEN 0
            WHEN hs.strokes = cp.par + 2 THEN 2
            WHEN hs.strokes = cp.par + 1 THEN 3
            WHEN hs.strokes = cp.par THEN 4
            WHEN hs.strokes = cp.par - 1 THEN 5
            WHEN hs.strokes <= cp.par - 2 THEN 6
            ELSE 0
          END
        ELSE
          CASE 
            WHEN hs.strokes >= cp.par + 3 THEN 0
            WHEN hs.strokes = cp.par + 2 THEN 1
            WHEN hs.strokes = cp.par + 1 THEN 2
            WHEN hs.strokes = cp.par THEN 3
            WHEN hs.strokes = cp.par - 1 THEN 4
            WHEN hs.strokes = cp.par - 2 THEN 5
            WHEN hs.strokes <= cp.par - 3 THEN 6
            ELSE 0
          END
      END
    ) as ips_points
  FROM hole_scores hs
  JOIN pairings p ON hs.pairing_id = p.pairing_id
  JOIN course_pars cp ON hs.hole_number = cp.hole_number
  WHERE p.adhoc_game_id = 33
  GROUP BY hs.member_id, p.playing_handicap
)
INSERT INTO performance_records (
  member_id, course_id, game_date, club_id,
  points, gross_score,
  medal_game, medal_gross, medal_net, medal_points
)
SELECT 
  ps.member_id,
  gi.course_id,
  gi.game_date,
  gi.club_id,
  ps.ips_points as points,
  ps.gross_score,
  false as medal_game,
  ps.gross_score as medal_gross,
  ps.gross_score - ps.playing_handicap as medal_net,
  0 as medal_points
FROM player_scores ps
CROSS JOIN game_info gi
ON CONFLICT DO NOTHING;

-- Verify results
SELECT 'day_results inserted' as status, COUNT(*) as count
FROM day_results
WHERE game_date = '2026-03-15' AND club_id = 1;
