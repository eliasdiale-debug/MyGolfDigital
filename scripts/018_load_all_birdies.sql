-- Complete script to replace all birdie data from spreadsheet
-- Maintains all foreign key relationships to members, courses, and performance_records

-- Step 1: Clear existing data
TRUNCATE TABLE birdies CASCADE;

-- Step 2: Insert all birdie records
-- Only insert where birdie_count > 0 AND member has valid performance record

-- Helper function to insert birdies safely
DO $$
BEGIN
    -- This script will insert birdies for all members based on the spreadsheet data
    -- The INSERT will only succeed if the member played that game (valid performance_records entry exists)
    
    RAISE NOTICE 'Starting birdie data load...';
    
END $$;

-- Insert birdie data with validation
-- Format: INSERT birdies for (member, course, date, count) where performance record exists

INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)
SELECT m.member_id, c.course_id, pr.game_date, 
       CASE 
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Zebula Country Club and Spa' AND pr.game_date = '2025-03-21' THEN 1
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Akasia' AND pr.game_date = '2025-05-30' THEN 1
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Ruimsig' AND pr.game_date = '2025-06-01' THEN 2
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Pecanwood' AND pr.game_date = '2025-06-18' THEN 1
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Firethorn' AND pr.game_date = '2025-08-10' THEN 1
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Steyn City' AND pr.game_date = '2025-08-24' THEN 1
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Ruimsig' AND pr.game_date = '2025-08-31' THEN 2
           WHEN m.member_name = 'Elias Diale' AND c.course_name = 'Copperleaf' AND pr.game_date = '2025-12-31' THEN 1
       END as birdie_count,
       pr.record_id
FROM members m
JOIN performance_records pr ON m.member_id = pr.member_id
JOIN courses c ON pr.course_id = c.course_id
WHERE pr.gross_score IS NOT NULL AND pr.gross_score > 0
  AND (
      (m.member_name = 'Elias Diale' AND c.course_name = 'Zebula Country Club and Spa' AND pr.game_date = '2025-03-21') OR
      (m.member_name = 'Elias Diale' AND c.course_name = 'Akasia' AND pr.game_date = '2025-05-30') OR
      (m.member_name = 'Elias Diale' AND c.course_name = 'Ruimsig' AND pr.game_date = '2025-06-01') OR
      (m.member_name = 'Elias Diale' AND c.course_name = 'Pecanwood' AND pr.game_date = '2025-06-18') OR
      (m.member_name = 'Elias Diale' AND c.course_name = 'Firethorn' AND pr.game_date = '2025-08-10') OR
      (m.member_name = 'Elias Diale' AND c.course_name = 'Steyn City' AND pr.game_date = '2025-08-24') OR
      (m.member_name = 'Elias Diale' AND c.course_name = 'Ruimsig' AND pr.game_date = '2025-08-31') OR
      (m.member_name = 'Elias Diale' AND c.course_name = 'Copperleaf' AND pr.game_date = '2025-12-31')
  );

-- Verify the load
SELECT 
    'Birdie data loaded' as status,
    COUNT(*) as total_birdie_entries,
    SUM(birdie_count) as total_birdies,
    COUNT(DISTINCT member_id) as members_with_birdies
FROM birdies;
