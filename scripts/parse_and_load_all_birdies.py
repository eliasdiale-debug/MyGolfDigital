import os
import re
from datetime import datetime

def parse_birdie_spreadsheet(file_path):
    """Parse the birdie spreadsheet and generate SQL INSERT statements."""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Parse the spreadsheet structure
    # Row 1-3: Headers
    # Row 4: Course names (row index 3)
    # Row 6: Dates (row index 5)
    # Rows 8-50: Member data (row indices 7-49)
    
    # Extract dates from row 6
    date_line = lines[5].strip() if len(lines) > 5 else ""
    date_cells = date_line.split('\t')
    
    # Extract course names from row 4
    course_line = lines[3].strip() if len(lines) > 3 else ""
    course_cells = course_line.split('\t')
    
    # Parse dates - convert from DD/MMM/YYYY format
    dates = []
    for cell in date_cells[1:]:  # Skip first column (member names)
        cell = cell.strip()
        if cell:
            try:
                # Parse dates like "29/Nov/2024" or "06/Dec/2024"
                date_obj = datetime.strptime(cell, "%d/%b/%Y")
                dates.append(date_obj.strftime("%Y-%m-%d"))
            except:
                dates.append(None)
        else:
            dates.append(None)
    
    # Parse courses
    courses = []
    for cell in course_cells[1:]:  # Skip first column
        cell = cell.strip()
        courses.append(cell if cell else None)
    
    # Generate SQL VALUES entries
    sql_values = []
    
    # Parse member rows (rows 8-50, indices 7-49)
    for line_idx in range(7, min(50, len(lines))):
        line = lines[line_idx].strip()
        if not line:
            continue
            
        cells = line.split('\t')
        if len(cells) < 2:
            continue
            
        member_name = cells[0].strip()
        if not member_name:
            continue
        
        # Parse birdie counts for this member across all dates
        for col_idx in range(1, len(cells)):
            cell_value = cells[col_idx].strip()
            
            # Check if this cell has a birdie count
            if cell_value and cell_value.isdigit():
                birdie_count = int(cell_value)
                if birdie_count > 0:
                    # Get corresponding date
                    date_idx = col_idx - 1
                    if date_idx < len(dates) and dates[date_idx]:
                        game_date = dates[date_idx]
                        sql_values.append(f"  ('{member_name}', '{game_date}', {birdie_count})")
    
    return sql_values

def generate_sql(sql_values):
    """Generate complete SQL INSERT statement."""
    
    sql = """-- Clear existing birdie data
DELETE FROM birdies;

-- Insert ALL birdie data from comprehensive spreadsheet for all 43 members
INSERT INTO birdies (member_id, course_id, game_date, birdie_count, record_id)
SELECT 
  m.member_id,
  pr.course_id,
  pr.game_date,
  bd.birdie_count,
  pr.record_id
FROM (VALUES
"""
    
    # Add all VALUES entries
    sql += ",\n".join(sql_values)
    
    sql += """
) AS bd(member_name, game_date, birdie_count)
JOIN members m ON m.member_name = bd.member_name
JOIN performance_records pr ON pr.member_id = m.member_id 
  AND pr.game_date = bd.game_date::date
WHERE pr.gross_score IS NOT NULL AND pr.gross_score > 0;

SELECT 'Loaded ' || COUNT(*) || ' birdie records for ' || COUNT(DISTINCT member_id) || ' members' as status 
FROM birdies;"""
    
    return sql

# Main execution
if __name__ == "__main__":
    # Path to the spreadsheet file
    spreadsheet_path = "../user_read_only_context/text_attachments/pasted-text-nXfiA.txt"
    
    print("Parsing birdie spreadsheet...")
    sql_values = parse_birdie_spreadsheet(spreadsheet_path)
    
    print(f"Found {len(sql_values)} birdie entries across all members")
    
    # Generate complete SQL
    sql = generate_sql(sql_values)
    
    # Save SQL to file
    output_path = "load_all_birdies.sql"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(sql)
    
    print(f"SQL script saved to {output_path}")
    print(f"Total birdie entries to load: {len(sql_values)}")
    print("\nFirst 5 entries:")
    for i, entry in enumerate(sql_values[:5]):
        print(entry)
