import csv
import os
from datetime import datetime

# Read the CSV file
csv_path = os.path.join(os.path.dirname(__file__), '..', 'user_read_only_context', 'text_attachments', 'Birdies-lCNJi.csv')

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.reader(f, delimiter=';')
    rows = list(reader)

# Row 6 contains the dates (index 5 in 0-based)
date_row = rows[5]  # Row 6 in the CSV
dates = []
for i in range(2, len(date_row), 2):  # Skip first 2 columns, then every other column
    date_str = date_row[i].strip()
    if date_str and date_str != '':
        try:
            # Parse date in format DD/MMM/YYYY
            date_obj = datetime.strptime(date_str, '%d/%b/%Y')
            dates.append(date_obj.strftime('%Y-%m-%d'))
        except:
            dates.append(None)
    else:
        dates.append(None)

# Generate SQL INSERT statements
print("-- Clear existing birdie data")
print("DELETE FROM birdies;")
print()
print("-- Insert complete birdie dataset from CSV")
print("INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)")
print("SELECT ")
print("  m.member_id,")
print("  pr.course_id,")
print("  pr.game_date,")
print("  bd.birdie_count,")
print("  pr.record_id")
print("FROM (VALUES")

values = []

# Process member rows (starting from row 8, index 7)
for row_idx in range(7, len(rows)):
    row = rows[row_idx]
    if len(row) < 3:
        continue
    
    member_name = row[1].strip()
    if not member_name or member_name == '':
        continue
    
    # Extract birdie counts from odd columns (3, 5, 7, ...)
    birdie_col_idx = 2
    date_idx = 0
    
    for col_idx in range(2, len(row), 2):
        if date_idx >= len(dates):
            break
        
        date = dates[date_idx]
        if date and col_idx < len(row):
            birdie_str = row[col_idx].strip()
            try:
                birdie_count = int(birdie_str)
                if birdie_count > 0:
                    values.append(f"  ('{member_name}', '{date}', {birdie_count})")
            except:
                pass
        
        date_idx += 1

# Print VALUES
for i, val in enumerate(values):
    if i < len(values) - 1:
        print(val + ",")
    else:
        print(val)

print(") AS bd(member_name, game_date, birdie_count)")
print("JOIN members m ON m.member_name = bd.member_name")
print("JOIN performance_records pr ON pr.member_id = m.member_id ")
print("  AND pr.game_date = bd.game_date::date")
print("WHERE pr.gross_score IS NOT NULL AND pr.gross_score > 0;")
print()
print("SELECT 'Loaded ' || COUNT(*) || ' birdie records for ' || COUNT(DISTINCT member_id) || ' members. Total birdies: ' || SUM(birdie_count) as status ")
print("FROM birdies;")
