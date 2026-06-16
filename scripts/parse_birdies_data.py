# Python script to parse birdie data from the spreadsheet and generate SQL inserts
# This maintains all foreign key relationships

import csv
from datetime import datetime

# The data structure from pasted-text.txt
# Row 1: Course names
# Row 2: Points/Gross labels (skip)
# Row 3: Dates
# Row 4: Total birdies per column (skip for now)
# Row 5+: Member name followed by birdie counts

# Parse the raw data
courses = [
    "Killarney", "Wanderers", "Steyn City", "Modderfontein", "Copperleaf", "CCJ Rocklands",
    "Waterkloof", "Serengeti", "CCJ Woodmead", "Bryanston", "CCJ Rocklands", "Steyn City",
    "Paarl", "Royal JHB East", "Bryanston", "Steyn City", "Killarney", "Soweto Country Club",
    "Jackal Creek", "Houghton", "Southdowns", "Copperleaf", "Centurion", "Huddle Park",
    "Waterkloof", "Woodhill", "Kempton Park", "Rustenburg", "Kyalami", "Benoni Country Club",
    "Services", "Pretoria West", "Glenvista", "Reading", "Wingate", "Akasia", "Ruimsig",
    "Wanderers", "Pecanwood", "Ruimsig", "Euphoria", "Euphoria", "Blue Valley", "Wanderers",
    "Parkview", "Royal JHB East", "Observatory", "Royal JHB East", "Zebula Country Club and Spa",
    "Zebula Country Club and Spa", "Kempton Park", "Glendower", "CMR", "Dainfern", "Kyalami",
    "Huddle Park", "Firethorn", "Blue Valley", "Wingate", "Kyalami", "Ebotse", "Kyalami",
    "Jackal Creek", "Killarney", "Steyn City", "Services", "Ruimsig", "Pretoria Country Club",
    "Gowrie Farm", "Copperleaf", "Centurion", "Huddle Park", "Krugersdorp", "Glendower",
    "Glendower", "Kempton Park", "Steyn City", "ERPM", "Jackal Creek", "Heron Banks",
    "Glendower", "Waterkloof", "Benoni Country Club", "Euphoria", "Wingate", "Kyalami",
    "Blue Valley", "Pretoria West", "CMR", "Akasia", "Magalies", "Soutpansberg Golf Club",
    "Services", "Wanderers", "Wanderers", "Emfuleni", "Killarney", "Kyalami", "Huddle Park",
    "Houghton", "Kyalami", "Kempton Park", "CMR", "Dainfern", "CCJ Woodmead", "Southdowns",
    "Killarney", "Heron Banks", "Heron Banks", "Killarney", "Soweto Country Club", "Huddle Park",
    "Reading", "Modderfontein", "Stellenbosch", "Steenberg", "Kempton Park", "Copperleaf",
    "Kyalami", "Glenvista", "Gary Player", "Waterkloof", "Services"
]

dates = [
    "2024-11-29", "2024-12-06", "2024-12-08", "2024-12-13", "2024-12-15", "2024-12-20",
    "2024-12-22", "2024-12-24", "2024-12-27", "2024-12-29", "2024-12-31", "2025-01-03",
    "2025-01-03", "2025-01-05", "2025-01-10", "2025-01-12", "2025-01-17", "2025-01-19",
    "2025-01-24", "2025-01-26", "2025-01-31", "2025-02-02", "2025-02-07", "2025-02-09",
    "2025-02-14", "2025-02-16", "2025-02-21", "2025-02-23", "2025-02-28", "2025-03-02",
    "2025-03-09", "2025-03-16", "2025-03-21", "2025-03-21", "2025-03-23", "2025-04-06",
    "2025-04-13", "2025-04-17", "2025-04-19", "2025-04-21", "2025-04-26", "2025-04-27",
    "2025-05-01", "2025-05-04", "2025-05-08", "2025-05-09", "2025-05-11", "2025-05-15",
    "2025-05-16", "2025-05-17", "2025-05-23", "2025-05-30", "2025-05-30", "2025-06-01",
    "2025-06-06", "2025-06-08", "2025-06-13", "2025-06-16", "2025-06-18", "2025-06-27",
    "2025-06-29", "2025-07-06", "2025-07-11", "2025-07-18", "2025-07-20", "2025-07-27",
    "2025-08-01", "2025-08-03", "2025-08-08", "2025-08-09", "2025-08-10", "2025-08-15",
    "2025-08-17", "2025-08-21", "2025-08-24", "2025-08-31", "2025-09-05", "2025-09-07",
    "2025-09-12", "2025-09-14", "2025-09-18", "2025-09-19", "2025-09-21", "2025-09-23",
    "2025-09-24", "2025-09-25", "2025-09-26", "2025-09-28", "2025-10-03", "2025-10-05",
    "2025-10-10", "2025-10-11", "2025-10-12", "2025-10-17", "2025-10-17", "2025-10-19",
    "2025-10-22", "2025-10-23", "2025-10-24", "2025-10-26", "2025-10-31", "2025-11-02",
    "2025-11-07", "2025-11-09", "2025-11-12", "2025-11-14", "2025-11-18", "2025-11-21",
    "2025-11-22", "2025-12-05", "2025-12-07", "2025-12-12", "2025-12-14", "2025-12-16",
    "2025-12-18", "2025-12-19", "2025-12-23", "2025-12-31", "2026-01-02", "2026-01-04",
    "2026-01-07", "2026-01-09", "2026-01-11"
]

# Member birdie data (member_name: [birdie_counts])
# This would be parsed from the full dataset
members_birdies = {
    "Elias Diale": [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,0,2,0,0,0,1,0,2,0,0,0,0,0,1,0,0,0,1,3,0,3,1,0,0,0,1,0,0,2,0,0,3,0,1,0,0,2,1,0,1,0,0,0],
    # Add all other members...
}

print("-- Truncate existing birdie data")
print("TRUNCATE TABLE birdies CASCADE;")
print("")
print("-- Insert new birdie data with foreign key references")

# Generate SQL for each member
for member_name, birdie_counts in members_birdies.items():
    for idx, count in enumerate(birdie_counts):
        if count > 0 and idx < len(courses) and idx < len(dates):
            course = courses[idx]
            date = dates[idx]
            print(f"""
INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)
SELECT m.member_id, c.course_id, pr.game_date, {count}, pr.record_id
FROM members m, courses c, performance_records pr
WHERE m.member_name = '{member_name}'
  AND c.course_name = '{course}'
  AND pr.game_date = '{date}'
  AND m.member_id = pr.member_id
  AND c.course_id = pr.course_id
  AND pr.gross_score IS NOT NULL
  AND pr.gross_score > 0
ON CONFLICT DO NOTHING;""")

print("\nSELECT 'Birdies data loaded successfully' as status;")
