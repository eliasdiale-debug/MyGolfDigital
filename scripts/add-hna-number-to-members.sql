-- Add hna_number to members table for HNA handicap lookup
ALTER TABLE members ADD COLUMN IF NOT EXISTS hna_number text;

-- Add hna_last_synced to member_handicap_indices so we know when HNA was last pulled
ALTER TABLE member_handicap_indices ADD COLUMN IF NOT EXISTS hna_last_synced timestamp with time zone;
ALTER TABLE member_handicap_indices ADD COLUMN IF NOT EXISTS hna_sync_source text DEFAULT 'manual'; -- 'manual' | 'hna_api' | 'hna_scrape'
