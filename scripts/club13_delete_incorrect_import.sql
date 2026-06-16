-- Delete incorrect Club 13 import (all 9 games and their 2700 pairings/performance records)
DELETE FROM pairings WHERE adhoc_game_id IN (SELECT adhoc_game_id FROM adhoc_games WHERE club_id = 13 AND game_date >= '2026-01-14' AND game_date <= '2026-03-11');
DELETE FROM performance_records WHERE club_id = 13 AND game_date >= '2026-01-14' AND game_date <= '2026-03-11';
DELETE FROM adhoc_games WHERE club_id = 13 AND game_date >= '2026-01-14' AND game_date <= '2026-03-11';
