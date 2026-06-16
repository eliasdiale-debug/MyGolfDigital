-- Insert Tsepo Lepono's results for Feb 21 Serengeti game
-- Gross=93, Playing HCP=15, Par=72, Net=78, Stableford Points=36-(78-72)=30, 1 birdie

-- day_results
INSERT INTO day_results (game_date, course_id, member_id, points, gross_score, playing_handicap, birdies_count, eagles_count, ladies_count, is_late, is_sub, cash_paid, no_show_fee, birdie_pool, lady_payout, late_payout, sub_payout, total_club, eagle_payout, total_member, debtor_creditor, club_id)
VALUES ('2026-02-21', 82, 41, 30, 93, 15.0, 1, 0, 0, false, false, 600.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1);

-- birdies record (1 birdie, linked to record_id 282)
INSERT INTO birdies (member_id, course_id, record_id, game_date, birdie_count)
VALUES (41, 82, 282, '2026-02-21', 1);
