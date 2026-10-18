import os
import re
from datetime import datetime

# Read the birdie spreadsheet file
file_path = os.path.join(os.path.dirname(__file__), '..', 'user_read_only_context', 'text_attachments', 'pasted-text-nXfiA.txt')

print(f"Reading birdie data from: {file_path}")

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse the structure
# Row 4 (index 3): Course names
# Row 6 (index 5): Dates  
# Rows 8+ (index 7+): Member data with birdie counts

courses_line = lines[3].strip().split('\t')
dates_line = lines[5].strip().split('\t')

# Extract courses and dates (they appear every 8 columns starting at column 2)
courses = []
dates = []

print("\nParsing dates and courses...")
for i in range(2, min(len(courses_line), len(dates_line)), 8):
    if i < len(courses_line) and courses_line[i] and courses_line[i].strip():
        course = courses_line[i].strip()
        courses.append(course)
        
    if i < len(dates_line) and dates_line[i] and dates_line[i].strip():
        date_str = dates_line[i].strip()
        try:
            # Convert DD/MMM/YYYY or DD/Mon/YYYY to YYYY-MM-DD
            date_obj = datetime.strptime(date_str, '%d/%b/%Y')
            dates.append(date_obj.strftime('%Y-%m-%d'))
        except Exception as e:
            print(f"Error parsing date '{date_str}': {e}")
            dates.append(None)

print(f"Found {len(courses)} courses and {len(dates)} dates")

# Parse member data and generate SQL INSERT VALUES
print("\nParsing member birdie data...")
insert_values = []

for row_idx in range(7, len(lines)):
    parts = lines[row_idx].strip().split('\t')
    if len(parts) < 3:
        continue
        
    member_name = parts[1].strip() if len(parts) > 1 else None
    if not member_name:
        continue
    
    # For each game date, check if there's a birdie count
    for game_idx in range(min(len(courses), len(dates))):
        col_idx = 2 + (game_idx * 8)  # Points column for this game
        if col_idx < len(parts):
            birdie_str = parts[col_idx].strip()
            if birdie_str and birdie_str.isdigit() and int(birdie_str) > 0:
                birdie_count = int(birdie_str)
                course = courses[game_idx]
                date = dates[game_idx]
                
                # Create a tuple for the INSERT VALUES
                # We'll match against performance_records via member_name, course_name, and game_date
                insert_values.append((member_name, course, date, birdie_count))

print(f"\nFound {len(insert_values)} birdie entries to insert")

# Generate the comprehensive SQL
print("\n-- Clear existing birdies")
print("DELETE FROM birdies;\n")

print("-- Insert all birdie data")
print("INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)")
print("SELECT")
print("  m.member_id,")
print("  pr.course_id,")
print("  pr.game_date,")
print("  birdie_data.birdie_count,")
print("  pr.record_id")
print("FROM (VALUES")

# Output all the birdie data as SQL VALUES
for idx, (member_name, course, date, count) in enumerate(insert_values):
    comma = "," if idx < len(insert_values) - 1 else ""
    # Escape single quotes in names
    member_name_escaped = member_name.replace("'", "''")
    course_escaped = course.replace("'", "''")
    print(f"  ('{member_name_escaped}', '{course_escaped}', '{date}'::date, {count}){comma}")

print(") AS birdie_data(member_name, course_name, game_date, birdie_count)")
print("JOIN members m ON m.member_name = birdie_data.member_name")
print("JOIN courses c ON c.course_name = birdie_data.course_name")
print("JOIN performance_records pr ON pr.member_id = m.member_id")
print("  AND pr.course_id = c.course_id")
print("  AND pr.game_date = birdie_data.game_date")
print("  AND pr.gross_score IS NOT NULL")
print("  AND pr.gross_score > 0;")

print("\n-- Verify the load")
print("SELECT")
print("  'Loaded ' || COUNT(*) || ' birdie records for ' ||")
print("  COUNT(DISTINCT member_id) || ' members' as status")
print("FROM birdies;")

print(f"\n-- Script complete. Generated SQL to load {len(insert_values)} birdie entries.")
