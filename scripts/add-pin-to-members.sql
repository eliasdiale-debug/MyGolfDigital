-- Add PIN columns to members table
-- pin: bcrypt-hashed 5-digit PIN (NULL until member sets it)
-- pin_set: flag so login knows to use PIN vs legacy contact_number fallback

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pin_set BOOLEAN NOT NULL DEFAULT FALSE;

-- Index to speed up login lookups by name
CREATE INDEX IF NOT EXISTS idx_members_member_name_lower ON members (lower(member_name));
