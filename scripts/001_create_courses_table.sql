-- Create golf courses table
CREATE TABLE IF NOT EXISTS courses (
  course_id SERIAL PRIMARY KEY,
  course_name VARCHAR(100) NOT NULL UNIQUE,
  course_rating DECIMAL(4,1),
  slope_rating INTEGER,
  tee_color VARCHAR(20),
  location VARCHAR(100),
  par INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_courses_name ON courses(course_name);

SELECT 'Courses table created successfully' as status;
