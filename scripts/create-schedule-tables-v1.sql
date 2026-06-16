-- Create Annual Schedule table
CREATE TABLE IF NOT EXISTS annual_schedule (
  schedule_id SERIAL PRIMARY KEY,
  game_date DATE NOT NULL,
  day_of_week VARCHAR(20) NOT NULL,
  activity VARCHAR(100) NOT NULL,
  format VARCHAR(20) NOT NULL,
  course_name VARCHAR(100),
  event_type VARCHAR(50) DEFAULT 'regular',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Game Bookings table
CREATE TABLE IF NOT EXISTS game_bookings (
  booking_id SERIAL PRIMARY KEY,
  schedule_id INTEGER REFERENCES annual_schedule(schedule_id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES members(member_id) ON DELETE CASCADE,
  booking_status VARCHAR(20) DEFAULT 'confirmed',
  booked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(schedule_id, member_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_schedule_date ON annual_schedule(game_date);
CREATE INDEX IF NOT EXISTS idx_bookings_member ON game_bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_schedule ON game_bookings(schedule_id);

-- Insert 2026 Annual Schedule data
INSERT INTO annual_schedule (game_date, day_of_week, activity, format, course_name, event_type) VALUES
('2026-01-04', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Glenvista', 'regular'),
('2026-01-11', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Services', 'regular'),
('2026-01-18', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'ERPM', 'regular'),
('2026-01-25', 'Sunday', 'Medal Game', 'Medal', 'Copperleaf', 'medal'),
('2026-02-01', 'Sunday', 'First Kilimanjaro Game', 'IPS', 'CMR', 'kilimanjaro'),
('2026-02-08', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Killarney', 'regular'),
('2026-02-15', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Krugersdorp', 'regular'),
('2026-02-22', 'Sunday', 'Medal Game', 'Medal', 'Soweto Country Club', 'medal'),
('2026-03-01', 'Sunday', 'Second Kilimanjaro Game', 'IPS', 'Magalies', 'kilimanjaro'),
('2026-03-08', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Pretoria Golf Club', 'regular'),
('2026-03-15', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Wingate', 'regular'),
('2026-03-22', 'Sunday', 'Ironman 36 Hole Challenge', 'IPS', 'Benoni''s', 'special'),
('2026-03-29', 'Sunday', 'Medal Game', 'Medal', 'Ruimsig', 'medal'),
('2026-04-05', 'Sunday', 'Third Kilimanjaro Game', 'IPS', 'Kyalami', 'kilimanjaro'),
('2026-04-12', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Killarney', 'regular'),
('2026-04-19', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Wanderers', 'regular'),
('2026-04-25', 'Saturday', 'HM Invitational 2026 Golf Day', 'IPS', 'Euphoria', 'special'),
('2026-04-26', 'Sunday', 'Medal Game', 'Medal', 'Eagle Canyon', 'medal'),
('2026-05-03', 'Sunday', 'Chairman''s Cup', 'N/A', 'Wanderers', 'chairmans'),
('2026-05-10', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Pretoria Country Club', 'regular'),
('2026-05-17', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Southdowns', 'regular'),
('2026-05-21', 'Thursday', 'WINTER CLASSIC', 'IPS', NULL, 'winter_classic'),
('2026-05-22', 'Friday', 'WINTER CLASSIC', 'IPS', NULL, 'winter_classic'),
('2026-05-23', 'Saturday', 'WINTER CLASSIC', 'IPS', NULL, 'winter_classic'),
('2026-05-24', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Observatory', 'regular'),
('2026-05-31', 'Sunday', 'Medal Game', 'Medal', 'Eye of Africa', 'medal'),
('2026-06-07', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'ERPM', 'regular'),
('2026-06-14', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Jackal Creek', 'regular'),
('2026-06-21', 'Sunday', 'Chairman''s Cup', 'IPS', 'Bushwillow', 'chairmans'),
('2026-06-28', 'Sunday', 'Medal Game', 'Medal', 'Modderfontein', 'medal'),
('2026-07-05', 'Sunday', 'Kilimanjaro Game - Quarterfinals', 'IPS', 'Heron Banks', 'kilimanjaro'),
('2026-07-12', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Steyn City', 'regular'),
('2026-07-19', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Royal Oak', 'regular'),
('2026-07-26', 'Sunday', 'Medal Game', 'Medal', 'Pecanwood', 'medal'),
('2026-08-02', 'Sunday', 'Kilimanjaro Game - Semi Finals', 'IPS', 'Wingate', 'kilimanjaro'),
('2026-08-09', 'Sunday', 'Copperleaf Fairways Finders', 'IPS', 'Centurion', 'special'),
('2026-08-10', 'Monday', 'Copperleaf Fairways Finders', 'IPS', 'Blue Valley', 'special'),
('2026-08-16', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'CCJ Woodmead', 'regular'),
('2026-08-23', 'Sunday', 'Chairman''s Cup', 'IPS', 'Parkview', 'chairmans'),
('2026-08-30', 'Sunday', 'Medal Game', 'Medal', 'Reading', 'medal'),
('2026-09-06', 'Sunday', 'Kilimanjaro Game - Finals', 'IPS', 'Benoni Country Club', 'kilimanjaro'),
('2026-09-13', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Services', 'regular'),
('2026-09-20', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Bryanston', 'regular'),
('2026-09-27', 'Sunday', 'Medal Game', 'Medal', 'Waterkloof', 'medal'),
('2026-10-04', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Firethorn', 'regular'),
('2026-10-11', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'State Mines', 'regular'),
('2026-10-18', 'Sunday', 'Chairman''s Cup', 'IPS', 'Houghton', 'chairmans'),
('2026-10-25', 'Sunday', 'Medal Game', 'Medal', 'Emfuleni', 'medal'),
('2026-11-01', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Akasia', 'regular'),
('2026-11-08', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Glendower', 'regular'),
('2026-11-15', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Pecanwood', 'regular'),
('2026-11-19', 'Thursday', 'Masters', 'IPS', NULL, 'masters'),
('2026-11-20', 'Friday', 'Masters', 'IPS', NULL, 'masters'),
('2026-11-21', 'Saturday', 'Masters', 'IPS', NULL, 'masters'),
('2026-11-22', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Huddle Park', 'regular'),
('2026-11-29', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Eagle Canyon', 'regular'),
('2026-12-06', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Ebotse', 'regular'),
('2026-12-13', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Eye of Africa', 'regular'),
('2026-12-16', 'Wednesday', 'Whiskey/Wine/Gin Tourney', 'IPS', NULL, 'special'),
('2026-12-20', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Steyn City', 'regular'),
('2026-12-27', 'Sunday', 'Remmoho Weekly Game', 'IPS', 'Silverlakes', 'regular');

-- Enable RLS
ALTER TABLE annual_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for annual_schedule (read-only for all authenticated users)
CREATE POLICY "Allow read access to schedule" ON annual_schedule FOR SELECT USING (true);

-- Create policies for game_bookings
CREATE POLICY "Allow read access to bookings" ON game_bookings FOR SELECT USING (true);
CREATE POLICY "Allow insert own bookings" ON game_bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update own bookings" ON game_bookings FOR UPDATE USING (true);
CREATE POLICY "Allow delete own bookings" ON game_bookings FOR DELETE USING (true);
