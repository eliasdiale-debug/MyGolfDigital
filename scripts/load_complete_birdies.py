import re
from datetime import datetime

# Read the spreadsheet data
with open('user_read_only_context/text_attachments/pasted-text-nXfiA.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Parse the data
# Row 6 (index 5): dates
# Row 4 (index 3): courses
# Rows 8-50 (index 7-49): member names and birdie counts

dates_line = lines[5].strip() if len(lines) > 5 else ""
courses_line = lines[3].strip() if len(lines) > 3 else ""

# Split by tab to get columns
dates = dates_line.split('\t')[1:]  # Skip first column (member name header)
courses = courses_line.split('\t')[1:]  # Skip first column

# Parse dates into proper format
parsed_dates = []
for date_str in dates:
    if date_str and date_str.strip():
        try:
            # Handle format like "29/Nov/2024"
            date_str = date_str.strip()
            dt = datetime.strptime(date_str, '%d/%b/%Y')
            parsed_dates.append(dt.strftime('%Y-%m-%d'))
        except:
            parsed_dates.append(None)
    else:
        parsed_dates.append(None)

# Generate SQL VALUES for all members
sql_values = []

for i in range(7, min(50, len(lines))):  # Rows 8-50 (index 7-49)
    line = lines[i].strip()
    if not line:
        continue
    
    parts = line.split('\t')
    if len(parts) < 2:
        continue
    
    member_name = parts[0].strip()
    birdie_counts = parts[1:]
    
    # For each date where this member has birdies
    for j, birdie_str in enumerate(birdie_counts):
        if j >= len(parsed_dates) or not parsed_dates[j]:
            continue
        
        birdie_str = birdie_str.strip()
        if birdie_str and birdie_str.isdigit() and int(birdie_str) > 0:
            birdie_count = int(birdie_str)
            date = parsed_dates[j]
            sql_values.append(f"  ('{member_name}', '{date}', {birdie_count})")

# Generate the complete SQL
sql = f"""-- Clear existing birdie data
DELETE FROM birdies;

-- Insert all birdie data from spreadsheet
INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)
SELECT 
  m.member_id,
  pr.course_id,
  pr.game_date,
  bd.birdie_count,
  pr.record_id
FROM (VALUES
{',\\n'.join(sql_values)}
) AS bd(member_name, game_date, birdie_count)
JOIN members m ON m.member_name = bd.member_name
JOIN performance_records pr ON pr.member_id = m.member_id 
  AND pr.game_date = bd.game_date::date
WHERE pr.gross_score IS NOT NULL AND pr.gross_score > 0;

SELECT 'Loaded ' || COUNT(*) || ' birdie records for ' || COUNT(DISTINCT member_id) || ' members' as status 
FROM birdies;"""

print(sql)
print(f"\n\n-- Generated {len(sql_values)} birdie entries")
