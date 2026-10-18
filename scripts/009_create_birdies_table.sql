-- Create Birdies Statistics Table
-- This table tracks birdies scored by members at various courses

CREATE TABLE IF NOT EXISTS birdies_statistics (
    birdie_id SERIAL PRIMARY KEY,
    record_id INTEGER, -- Added reference to performance_records
    member_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    game_date DATE NOT NULL,
    birdies_count INTEGER DEFAULT 0,
    points_scored INTEGER,
    gross_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    CONSTRAINT fk_birdies_performance 
        FOREIGN KEY (record_id) 
        REFERENCES performance_records(record_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_birdies_member 
        FOREIGN KEY (member_id) 
        REFERENCES members(member_id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_birdies_course 
        FOREIGN KEY (course_id) 
        REFERENCES courses(course_id) 
        ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate records
    CONSTRAINT unique_birdie_record 
        UNIQUE (member_id, course_id, game_date),
    
    -- Check constraint to ensure valid birdie counts
    CONSTRAINT check_birdies_count 
        CHECK (birdies_count >= 0)
);

-- Create indexes for faster queries
CREATE INDEX idx_birdies_member ON birdies_statistics(member_id);
CREATE INDEX idx_birdies_course ON birdies_statistics(course_id);
CREATE INDEX idx_birdies_date ON birdies_statistics(game_date);
CREATE INDEX idx_birdies_count ON birdies_statistics(birdies_count) WHERE birdies_count > 0;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_birdies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER birdies_updated_at_trigger
    BEFORE UPDATE ON birdies_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_birdies_updated_at();

-- Create a view for birdie leaderboard
CREATE OR REPLACE VIEW birdies_leaderboard AS
SELECT 
    m.member_id,
    m.member_name,
    COUNT(*) as total_games_with_birdies,
    SUM(bs.birdies_count) as total_birdies,
    ROUND(AVG(bs.birdies_count), 2) as avg_birdies_per_game,
    MAX(bs.birdies_count) as max_birdies_single_game,
    MAX(bs.game_date) as last_birdie_date
FROM members m
INNER JOIN birdies_statistics bs ON m.member_id = bs.member_id
WHERE bs.birdies_count > 0
GROUP BY m.member_id, m.member_name
ORDER BY total_birdies DESC, total_games_with_birdies DESC;

COMMENT ON TABLE birdies_statistics IS 'Tracks birdie statistics for members across different courses and dates';
COMMENT ON VIEW birdies_leaderboard IS 'Annual birdie leaderboard showing total birdies scored by each member';
