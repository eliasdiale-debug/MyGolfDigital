-- Create guests table for permanent guest storage
CREATE TABLE IF NOT EXISTS guests (
  guest_id SERIAL PRIMARY KEY,
  guest_name TEXT NOT NULL,
  handicap_index DECIMAL(4,1),
  phone TEXT,
  created_by INTEGER REFERENCES members(member_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add guest_id column to pairings if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pairings' AND column_name = 'guest_id') THEN
    ALTER TABLE pairings ADD COLUMN guest_id INTEGER REFERENCES guests(guest_id);
  END IF;
END $$;

-- Add guest_id column to adhoc_game_bookings if not exists  
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'adhoc_game_bookings' AND column_name = 'guest_id') THEN
    ALTER TABLE adhoc_game_bookings ADD COLUMN guest_id INTEGER REFERENCES guests(guest_id);
  END IF;
END $$;

-- Make member_id nullable in pairings (guests don't have member_id)
ALTER TABLE pairings ALTER COLUMN member_id DROP NOT NULL;

-- Make member_id nullable in adhoc_game_bookings
ALTER TABLE adhoc_game_bookings ALTER COLUMN member_id DROP NOT NULL;

-- Enable RLS
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated access to guests
CREATE POLICY "Allow all access to guests" ON guests FOR ALL USING (true) WITH CHECK (true);
