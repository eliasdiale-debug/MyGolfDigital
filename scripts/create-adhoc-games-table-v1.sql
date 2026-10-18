-- Create Adhoc Games table for member-created games
CREATE TABLE IF NOT EXISTS adhoc_games (
  adhoc_game_id SERIAL PRIMARY KEY,
  organizer_id INTEGER NOT NULL REFERENCES members(member_id),
  course_id INTEGER NOT NULL REFERENCES courses(course_id),
  game_date DATE NOT NULL,
  tee_off_time TIME NOT NULL,
  max_players INTEGER DEFAULT 4,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'full', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Adhoc Game Bookings table
CREATE TABLE IF NOT EXISTS adhoc_game_bookings (
  booking_id SERIAL PRIMARY KEY,
  adhoc_game_id INTEGER NOT NULL REFERENCES adhoc_games(adhoc_game_id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES members(member_id),
  booking_status VARCHAR(20) DEFAULT 'confirmed' CHECK (booking_status IN ('confirmed', 'cancelled')),
  booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(adhoc_game_id, member_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_adhoc_games_date ON adhoc_games(game_date);
CREATE INDEX IF NOT EXISTS idx_adhoc_games_organizer ON adhoc_games(organizer_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_games_status ON adhoc_games(status);
CREATE INDEX IF NOT EXISTS idx_adhoc_bookings_game ON adhoc_game_bookings(adhoc_game_id);
CREATE INDEX IF NOT EXISTS idx_adhoc_bookings_member ON adhoc_game_bookings(member_id);

-- Enable RLS
ALTER TABLE adhoc_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE adhoc_game_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for adhoc_games
CREATE POLICY "Allow all access to adhoc_games" ON adhoc_games FOR ALL USING (true) WITH CHECK (true);

-- Create policies for adhoc_game_bookings
CREATE POLICY "Allow all access to adhoc_game_bookings" ON adhoc_game_bookings FOR ALL USING (true) WITH CHECK (true);
