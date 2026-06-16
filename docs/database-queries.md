# Common Database Queries

## Member Statistics

### Get Member's Complete Game History
```sql
SELECT 
  pr.game_date,
  c.course_name,
  pr.gross_score,
  pr.points,
  b.birdie_count,
  e.eagle_count,
  l.ladies_count,
  la.was_late
FROM performance_records pr
JOIN members m ON pr.member_id = m.member_id
JOIN courses c ON pr.course_id = c.course_id
LEFT JOIN birdies b ON pr.record_id = b.record_id
LEFT JOIN eagles e ON pr.record_id = e.record_id
LEFT JOIN ladies l ON pr.record_id = l.record_id
LEFT JOIN late_arrivals la ON pr.record_id = la.record_id
WHERE m.member_name = 'Member Name'
ORDER BY pr.game_date DESC;
```

### Get Member's Current Handicap Index
```sql
SELECT 
  m.member_name,
  mhi.official_handicap_index,
  mhi.effective_date,
  mhi.season
FROM member_handicap_indices mhi
JOIN members m ON mhi.member_id = m.member_id
WHERE m.member_name = 'Member Name'
  AND mhi.effective_date = (
    SELECT MAX(effective_date)
    FROM member_handicap_indices
    WHERE member_id = m.member_id
  );
```

### Get Member's Account Balance
```sql
SELECT 
  m.member_name,
  SUM(a.credit - a.debit) as current_balance,
  MAX(a.transaction_date) as last_transaction_date
FROM accounts a
JOIN members m ON a.member_id = m.member_id
WHERE m.member_name = 'Member Name'
GROUP BY m.member_id, m.member_name;
```

## Leaderboards

### Overall Points Leaderboard
```sql
SELECT 
  m.member_name,
  COUNT(*) as games_played,
  SUM(pr.points) as total_points,
  AVG(pr.points) as avg_points,
  MAX(pr.points) as best_points
FROM performance_records pr
JOIN members m ON pr.member_id = m.member_id
GROUP BY m.member_id, m.member_name
ORDER BY total_points DESC
LIMIT 10;
```

### Course-Specific Performance
```sql
SELECT 
  c.course_name,
  m.member_name,
  COUNT(*) as times_played,
  AVG(pr.gross_score) as avg_score,
  AVG(pr.points) as avg_points
FROM performance_records pr
JOIN members m ON pr.member_id = m.member_id
JOIN courses c ON pr.course_id = c.course_id
WHERE c.course_name = 'Course Name'
GROUP BY c.course_id, c.course_name, m.member_id, m.member_name
ORDER BY avg_points DESC;
```

## Activity Analysis

### Members with Most Birdies This Season
```sql
SELECT * FROM birdies_leaderboard
ORDER BY total_birdies DESC
LIMIT 10;
```

### Eagles Achieved by Member
```sql
SELECT * FROM eagles_leaderboard
WHERE member_name = 'Member Name';
```

### Social Golf Participation (Ladies Games)
```sql
SELECT * FROM ladies_leaderboard
ORDER BY total_ladies DESC;
```

### Punctuality Report
```sql
SELECT * FROM late_arrivals_leaderboard
ORDER BY total_late_arrivals DESC;
```

## Financial Reports

### Member Account Statement
```sql
SELECT 
  a.transaction_date,
  c.course_name,
  a.description,
  a.debit,
  a.credit,
  a.balance
FROM accounts a
JOIN members m ON a.member_id = m.member_id
LEFT JOIN courses c ON a.course_id = c.course_id
WHERE m.member_name = 'Member Name'
ORDER BY a.transaction_date DESC, a.account_id DESC;
```

### Outstanding Balances
```sql
SELECT 
  m.member_name,
  a.balance as current_balance
FROM members m
LEFT JOIN LATERAL (
  SELECT balance
  FROM accounts
  WHERE member_id = m.member_id
  ORDER BY transaction_date DESC, account_id DESC
  LIMIT 1
) a ON true
WHERE a.balance < 0
ORDER BY a.balance ASC;
