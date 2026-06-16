-- Create a function to cap playing handicap at 18 for Club ID 1 (ReMmoho)
CREATE OR REPLACE FUNCTION cap_club1_playing_handicap()
RETURNS TRIGGER AS $$
BEGIN
  -- Cap playing_handicap at 18 for ReMmoho (Club ID 1) members
  -- Get the club_id from the adhoc_games table
  DECLARE
    club_id_val INTEGER;
  BEGIN
    SELECT ag.club_id INTO club_id_val
    FROM adhoc_games ag
    WHERE ag.adhoc_game_id = NEW.adhoc_game_id;
    
    -- If this is a Club ID 1 game, cap the playing_handicap at 18
    IF club_id_val = 1 AND NEW.playing_handicap > 18 THEN
      NEW.playing_handicap := 18;
    END IF;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS enforce_club1_handicap_cap ON pairings;

-- Create trigger to enforce the cap on insert or update
CREATE TRIGGER enforce_club1_handicap_cap
BEFORE INSERT OR UPDATE ON pairings
FOR EACH ROW
EXECUTE FUNCTION cap_club1_playing_handicap();

-- Update any existing pairings for Club ID 1 that exceed 18
UPDATE pairings
SET playing_handicap = 18
FROM adhoc_games ag
WHERE pairings.adhoc_game_id = ag.adhoc_game_id
  AND ag.club_id = 1
  AND pairings.playing_handicap > 18;
