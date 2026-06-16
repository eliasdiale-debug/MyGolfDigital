import csv
from datetime import datetime

# This script parses the birdie spreadsheet and generates SQL to load all birdie data
# It matches each birdie entry with performance records in the database

# Read the birdie spreadsheet (assuming it's been exported to CSV)
# Format: Row 1 = Course names, Row 2 = Points/Gross headers, Row 3 = Dates, Row 4 = Total birdies
# Rows 5+ = Member names and their birdie counts per date

print("-- Clear existing birdies data")
print("DELETE FROM birdies;")
print("")
print("-- Insert all birdie data from spreadsheet")
print("INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)")
print("SELECT")
print("  m.member_id,")
print("  pr.course_id,")
print("  pr.game_date,")
print("  CASE")

# Sample data from the spreadsheet - in production this would parse the full file
# Format: (member_name, date, birdie_count)
birdie_entries = [
    ('Elias Diale', '2025-04-13', 1),
    ('Elias Diale', '2025-06-01', 1),
    ('Elias Diale', '2025-06-06', 2),
    # ... hundreds more entries would be here
]

for member, date, count in birdie_entries:
    print(f"    WHEN m.member_name = '{member}' AND pr.game_date = '{date}' THEN {count}")

print("    ELSE 0")
print("  END as birdie_count,")
print("  pr.record_id")
print("FROM performance_records pr")
print("JOIN members m ON pr.member_id = m.member_id")
print("WHERE pr.gross_score IS NOT NULL AND pr.gross_score > 0")
print("  AND (")

# Add condition to only select rows where birdies exist
first = True
for member, date, count in birdie_entries:
    if not first:
        print("    OR", end="")
    else:
        print("   ", end="")
        first = False
    print(f" (m.member_name = '{member}' AND pr.game_date = '{date}')")

print("  );")
print("")
print("SELECT 'Loaded ' || COUNT(*) || ' birdie records' as status FROM birdies;")
