-- Add club_id serial primary key to golf_clubs (keeping club_name unique)
ALTER TABLE golf_clubs DROP CONSTRAINT golf_clubs_pkey;
ALTER TABLE golf_clubs ADD COLUMN club_id SERIAL PRIMARY KEY;
ALTER TABLE golf_clubs ADD CONSTRAINT golf_clubs_club_name_unique UNIQUE (club_name);

-- Add club_id foreign key to members
ALTER TABLE members ADD COLUMN club_id INTEGER REFERENCES golf_clubs(club_id);

-- Link all existing members to Remmoho Golf Club (club_id = 1)
UPDATE members SET club_id = (SELECT club_id FROM golf_clubs WHERE club_name = 'Remmoho Golf Club');
