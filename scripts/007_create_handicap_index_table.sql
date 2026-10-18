-- Create table to store member handicap indices
CREATE TABLE IF NOT EXISTS member_handicap_indices (
    handicap_index_id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL,
    official_handicap_index NUMERIC(4,1) NOT NULL,
    season VARCHAR(10) NOT NULL, -- e.g. '2024/25'
    number_of_differentials INTEGER DEFAULT 0,
    max_differentials INTEGER DEFAULT 20,
    low_differentials_used INTEGER DEFAULT 6,
    effective_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key to members
    CONSTRAINT fk_member_handicap_index
        FOREIGN KEY (member_id)
        REFERENCES members(member_id)
        ON DELETE CASCADE,
    
    -- Unique constraint: one record per member per season
    CONSTRAINT unique_member_season
        UNIQUE (member_id, season)
);

-- Create table to store handicap differentials (scores used for handicap calculation)
CREATE TABLE IF NOT EXISTS handicap_differentials (
    differential_id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    game_date DATE NOT NULL,
    differential_value NUMERIC(4,1) NOT NULL, -- The calculated handicap differential
    gross_score INTEGER,
    course_rating NUMERIC(4,1),
    slope_rating INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    CONSTRAINT fk_differential_member
        FOREIGN KEY (member_id)
        REFERENCES members(member_id)
        ON DELETE CASCADE,
    
    CONSTRAINT fk_differential_course
        FOREIGN KEY (course_id)
        REFERENCES courses(course_id)
        ON DELETE CASCADE,
    
    -- Unique constraint: one differential per member per course per date
    CONSTRAINT unique_member_course_date_differential
        UNIQUE (member_id, course_id, game_date)
);

-- Create indexes for better query performance
CREATE INDEX idx_member_handicap_indices_member ON member_handicap_indices(member_id);
CREATE INDEX idx_member_handicap_indices_season ON member_handicap_indices(season);
CREATE INDEX idx_handicap_differentials_member ON handicap_differentials(member_id);
CREATE INDEX idx_handicap_differentials_course ON handicap_differentials(course_id);
CREATE INDEX idx_handicap_differentials_date ON handicap_differentials(game_date);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_handicap_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_member_handicap_indices_updated_at
    BEFORE UPDATE ON member_handicap_indices
    FOR EACH ROW
    EXECUTE FUNCTION update_handicap_updated_at();

CREATE TRIGGER trigger_handicap_differentials_updated_at
    BEFORE UPDATE ON handicap_differentials
    FOR EACH ROW
    EXECUTE FUNCTION update_handicap_updated_at();
