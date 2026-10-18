-- Create Members List table
CREATE TABLE IF NOT EXISTS members (
  member_id SERIAL PRIMARY KEY,
  member_name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_members_name ON members(member_name);

COMMENT ON TABLE members IS 'List of all golf club members';
COMMENT ON COLUMN members.member_id IS 'Unique identifier for each member';
COMMENT ON COLUMN members.member_name IS 'Full name of the member';
