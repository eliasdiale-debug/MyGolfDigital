import os
import re
from datetime import datetime

# Parse the birdie data from the text file
birdie_data_text = """
[The comprehensive data from pasted-text-nXfiA.txt would go here]
"""

# Read the actual file
file_path = '../user_read_only_context/text_attachments/pasted-text-nXfiA.txt'

def parse_birdie_spreadsheet():
    """Parse the birdie spreadsheet and generate SQL INSERT statements"""
    
    with open(file_path, 'r') as f:
        lines = f.readlines()
    
    # Row 4 contains course names (starting at column index 2, every 8 columns for "Points")
    courses_line = lines[3].strip().split('\t')
    
    # Row 6 contains dates (starting at column index 2, every 8 columns)
    dates_line = lines[5].strip().split('\t')
    
    # Extract courses and dates
    courses = []
    dates = []
    for i in range(2, len(courses_line), 8):
        if i < len(courses_line) and courses_line[i]:
            courses.append(courses_line[i])
        if i < len(dates_line) and dates_line[i]:
            date_str = dates_line[i]
            # Convert DD/MMM/YYYY to YYYY-MM-DD
            try:
                date_obj = datetime.strptime(date_str, '%d/%b/%Y')
                dates.append(date_obj.strftime('%Y-%m-%d'))
            except:
                dates.append(None)
    
    # Parse member data (rows 8 onwards)
    sql_cases = []
    
    for row_idx in range(7, len(lines)):
        parts = lines[row_idx].strip().split('\t')
        if len(parts) < 3:
            continue
            
        member_name = parts[1].strip() if len(parts) > 1 else None
        if not member_name:
            continue
        
        # Parse birdie counts for each game date
        # Starting at column 2, every 8 columns represents a game
        for game_idx, (course, date) in enumerate(zip(courses, dates)):
            col_idx = 2 + (game_idx * 8)  # Points column
            if col_idx < len(parts):
                birdie_count = parts[col_idx].strip()
                if birdie_count and birdie_count.isdigit() and int(birdie_count) > 0:
                    sql_cases.append(
                        f"      WHEN m.member_name = '{member_name}' AND pr.game_date = '{date}' AND c.course_name = '{course}' THEN {birdie_count}"
                    )
    
    return sql_cases

# Generate the SQL
cases = parse_birdie_spreadsheet()

print(f"-- Generated {len(cases)} birdie entries")
print("\nDELETE FROM birdies;")
print("\nWITH birdie_data AS (")
print("  SELECT")
print("    m.member_id,")
print("    c.course_id,")
print("    pr.game_date,")
print("    pr.record_id,")
print("    CASE")

for case in cases:
    print(case)

print("      ELSE 0")
print("    END as birdie_count")
print("  FROM performance_records pr")
print("  JOIN members m ON pr.member_id = m.member_id")
print("  JOIN courses c ON pr.course_id = c.course_id")
print("  WHERE pr.gross_score IS NOT NULL AND pr.gross_score > 0")
print(")")
print("INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)")
print("SELECT member_id, course_id, game_date, birdie_count, record_id")
print("FROM birdie_data")
print("WHERE birdie_count > 0;")
print("\nSELECT 'Loaded ' || COUNT(*) || ' birdie records' as status FROM birdies;")
