-- 1. Remove Golf Clinique (club_id=5, 0 members)
DELETE FROM golf_clubs WHERE club_id = 5;

-- 2. Add club_id to annual_schedule (all existing games belong to Remmoho = club_id 1)
ALTER TABLE annual_schedule ADD COLUMN IF NOT EXISTS club_id integer REFERENCES golf_clubs(club_id);
UPDATE annual_schedule SET club_id = 1 WHERE club_id IS NULL;

-- 3. Add club_id to adhoc_games (use organizer_id to find member's club)
ALTER TABLE adhoc_games ADD COLUMN IF NOT EXISTS club_id integer REFERENCES golf_clubs(club_id);
UPDATE adhoc_games ag SET club_id = m.club_id
FROM members m WHERE ag.organizer_id = m.member_id AND ag.club_id IS NULL;
UPDATE adhoc_games SET club_id = 1 WHERE club_id IS NULL;

-- 4. Add club_id to accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS club_id integer REFERENCES golf_clubs(club_id);
UPDATE accounts a SET club_id = m.club_id
FROM members m WHERE a.member_id = m.member_id AND a.club_id IS NULL;
UPDATE accounts SET club_id = 1 WHERE club_id IS NULL;

-- 5. Add club_id to performance_records
ALTER TABLE performance_records ADD COLUMN IF NOT EXISTS club_id integer REFERENCES golf_clubs(club_id);
UPDATE performance_records pr SET club_id = m.club_id
FROM members m WHERE pr.member_id = m.member_id AND pr.club_id IS NULL;
UPDATE performance_records SET club_id = 1 WHERE club_id IS NULL;

-- 6. Add club_id to day_results
ALTER TABLE day_results ADD COLUMN IF NOT EXISTS club_id integer REFERENCES golf_clubs(club_id);
UPDATE day_results dr SET club_id = m.club_id
FROM members m WHERE dr.member_id = m.member_id AND dr.club_id IS NULL;
UPDATE day_results SET club_id = 1 WHERE club_id IS NULL;
