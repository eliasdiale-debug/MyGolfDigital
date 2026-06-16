-- Extend game_bookings for guest support
ALTER TABLE game_bookings ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
ALTER TABLE game_bookings ADD COLUMN IF NOT EXISTS guest_handicap NUMERIC(4,1);

-- Create cancellations tracking table
CREATE TABLE IF NOT EXISTS annual_game_cancellations (
  cancellation_id SERIAL PRIMARY KEY,
  schedule_id INT NOT NULL,
  member_id INT REFERENCES members(member_id),
  guest_name VARCHAR(255),
  cancelled_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_by INT REFERENCES members(member_id)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_annual_cancel_schedule ON annual_game_cancellations(schedule_id);
