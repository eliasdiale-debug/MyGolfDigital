import re
from datetime import datetime

# Read the pasted text file
with open('user_read_only_context/text_attachments/pasted-text-nXfiA.txt', 'r') as f:
    lines = f.readlines()

# Parse the data structure
# Row 4 (index 3): Courses
# Row 6 (index 5): Dates  
# Rows 8-50 (index 7-49): Members and their birdie counts

courses_line = lines[3]
dates_line = lines[5]
member_lines = lines[7:]  # All member rows

# Parse dates from row 6
dates = []
date_pattern = r'(\d{2}/[A-Za-z]{3}/\d{4})'
for match in re.finditer(date_pattern, dates_line):
    date_str = match.group(1)
    # Convert to YYYY-MM-DD format
    date_obj = datetime.strptime(date_str, '%d/%b/%Y')
    dates.append(date_obj.strftime('%Y-%m-%d'))

# Parse courses from row 4
courses = []
# Split by tabs and filter out empty/numeric values
course_parts = courses_line.split('\t')
for part in course_parts:
    part = part.strip()
    # Skip if empty, numeric, or header text
    if part and not part.isdigit() and part not in ['Points', 'Gross', '0', '']:
        # Check if it looks like a course name (has letters)
        if any(c.isalpha() for c in part):
            courses.append(part)

print(f"Found {len(dates)} dates and {len(courses)} courses")
print(f"First 5 dates: {dates[:5]}")
print(f"First 5 courses: {courses[:5]}")

# Parse member data
sql_statements = []
for member_line in member_lines:
    parts = member_line.split('\t')
    if len(parts) < 3:
        continue
        
    # Extract member name (should be in column 2, index 1)
    member_name = parts[1].strip() if len(parts) > 1 else ''
    if not member_name or not any(c.isalpha() for c in member_name):
        continue
    
    print(f"\nProcessing member: {member_name}")
    
    # Find birdie counts - they should appear after the member name
    # Looking for numeric values in the data columns
    birdie_values = []
    for i, part in enumerate(parts[2:], start=2):  # Start from column after name
        part = part.strip()
        if part.isdigit():
            birdie_values.append(int(part))
        elif part == '':
            birdie_values.append(0)
    
    print(f"  Found {len(birdie_values)} birdie values")
    if birdie_values:
        print(f"  First 10: {birdie_values[:10]}")

print(f"\nTotal SQL statements to generate: (will be calculated after parsing)")
</parameter>
<parameter name="taskNameActive">Parsing birdie data</parameter>
<parameter name="taskNameComplete">Parsed birdie data
