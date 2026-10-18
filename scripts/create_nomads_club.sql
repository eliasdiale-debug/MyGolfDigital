-- Create the Nomads Club for independent golfers
-- This club will house all nomad members who aren't affiliated with a specific club

-- First check if club already exists to make this idempotent
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM golf_clubs WHERE club_name = 'Nomads Golf Club') THEN
    INSERT INTO golf_clubs (
      club_id,
      club_name,
      primary_contact_name,
      primary_contact_email,
      primary_contact_number,
      number_of_members,
      created_at,
      updated_at
    ) VALUES (
      999,
      'Nomads Golf Club',
      'FairWay Pro Admin',
      'admin@fairwaypro.co.za',
      '0000000000',
      0,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE 'Nomads Golf Club created with club_id = 999';
  ELSE
    RAISE NOTICE 'Nomads Golf Club already exists';
  END IF;
END $$;

-- Update any existing nomad members (user_type = 'nomad' or club_id IS NULL) to belong to Nomads Club
UPDATE members 
SET club_id = 999 
WHERE (user_type = 'nomad' OR club_id IS NULL)
  AND club_id != 999;

-- Add game_visibility column to adhoc_games if it doesn't exist
-- Values: 'club' (default - visible only to club members), 'public' (visible to everyone including nomads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'adhoc_games' AND column_name = 'game_visibility'
  ) THEN
    ALTER TABLE adhoc_games ADD COLUMN game_visibility VARCHAR(20) DEFAULT 'club';
    RAISE NOTICE 'Added game_visibility column to adhoc_games';
  END IF;
END $$;

-- Set default visibility for existing games
UPDATE adhoc_games 
SET game_visibility = 'club' 
WHERE game_visibility IS NULL;
