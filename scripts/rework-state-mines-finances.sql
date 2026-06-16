-- Rework State Mines Feb 22 finances
-- Total birdies across entire field: 11
-- Total players: 17
-- Birdie charge per player = (11 - own_birdies) * R20
-- Birdie earnings per player = own_birdies * R20 * 16 (other players)

-- Also mark as medal game in performance_records
UPDATE performance_records SET medal_game = true WHERE game_date = '2026-02-22';

-- First, delete duplicate account entries for Feb 22 (keeping only one per member)
DELETE FROM accounts WHERE transaction_date = '2026-02-22' AND account_id NOT IN (
  SELECT MIN(account_id) FROM accounts WHERE transaction_date = '2026-02-22' GROUP BY member_id
);

-- Now recalculate finances for each player
-- Formula:
-- sub_payout: based on points (unchanged)
-- lady_payout: R100 if ladies > 0 (unchanged)
-- birdie_pool (earnings): own_birdies * 20 * 16
-- birdie_charge: (11 - own_birdies) * 20
-- total_club = sub_payout + lady_payout + birdie_charge
-- total_member = birdie_pool (earnings)
-- debtor_creditor = total_member - total_club

-- Asaph (1): 0 birdies, 37pts, 0 ladies -> sub=0, birdie_charge=220, earnings=0, total_club=220, dc=-220
UPDATE day_results SET birdie_pool=0, total_club=220, total_member=0, debtor_creditor=-220 WHERE member_id=1 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=220, balance = balance + 20 - 220 WHERE member_id=1 AND transaction_date='2026-02-22';

-- Avhashoni (2): 0 birdies, 28pts, 1 lady -> sub=20, lady=100, birdie_charge=220, earnings=0, total_club=340, dc=-340
UPDATE day_results SET birdie_pool=0, total_club=340, total_member=0, debtor_creditor=-340 WHERE member_id=2 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=340, balance = balance + 160 - 340 WHERE member_id=2 AND transaction_date='2026-02-22';

-- Azwi (3): 0 birdies, 29pts, 0 ladies -> sub=20, birdie_charge=220, earnings=0, total_club=240, dc=-240
UPDATE day_results SET birdie_pool=0, total_club=240, total_member=0, debtor_creditor=-240 WHERE member_id=3 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=240, balance = balance + 80 - 240 WHERE member_id=3 AND transaction_date='2026-02-22';

-- Dan (8): 2 birdies, 39pts, 0 ladies -> sub=0, birdie_charge=(11-2)*20=180, earnings=2*20*16=640, total_club=180, dc=460
UPDATE day_results SET birdie_pool=640, total_club=180, total_member=640, debtor_creditor=460 WHERE member_id=8 AND game_date='2026-02-22';
UPDATE accounts SET debit=460, credit=0, balance = balance - 60 + 460 WHERE member_id=8 AND transaction_date='2026-02-22';

-- Elias (9): 1 birdie, 29pts, 0 ladies -> sub=20, birdie_charge=(11-1)*20=200, earnings=1*20*16=320, total_club=220, dc=100
UPDATE day_results SET birdie_pool=320, total_club=220, total_member=320, debtor_creditor=100 WHERE member_id=9 AND game_date='2026-02-22';
UPDATE accounts SET debit=100, credit=0, balance = balance - 40 + 100 WHERE member_id=9 AND transaction_date='2026-02-22';

-- Humbu (11): 0 birdies, 15pts, 0 ladies -> sub=100, birdie_charge=220, earnings=0, total_club=320, dc=-320
UPDATE day_results SET birdie_pool=0, total_club=320, total_member=0, debtor_creditor=-320 WHERE member_id=11 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=320, balance = balance + 140 - 320 WHERE member_id=11 AND transaction_date='2026-02-22';

-- Livhu (17): 1 birdie, 32pts, 0 ladies -> sub=0, birdie_charge=200, earnings=320, total_club=200, dc=120
UPDATE day_results SET birdie_pool=320, total_club=200, total_member=320, debtor_creditor=120 WHERE member_id=17 AND game_date='2026-02-22';
UPDATE accounts SET debit=120, credit=0, balance = balance - 0 + 120 WHERE member_id=17 AND transaction_date='2026-02-22';

-- Mandla (19): 1 birdie, 33pts, 0 ladies -> sub=0, birdie_charge=200, earnings=320, total_club=200, dc=120
UPDATE day_results SET birdie_pool=320, total_club=200, total_member=320, debtor_creditor=120 WHERE member_id=19 AND game_date='2026-02-22';
UPDATE accounts SET debit=120, credit=0, balance = balance - 40 + 120 WHERE member_id=19 AND transaction_date='2026-02-22';

-- Musandiwa (24): 1 birdie, 36pts, 0 ladies -> sub=0, birdie_charge=200, earnings=320, total_club=200, dc=120
UPDATE day_results SET birdie_pool=320, total_club=200, total_member=320, debtor_creditor=120 WHERE member_id=24 AND game_date='2026-02-22';
UPDATE accounts SET debit=120, credit=0, balance = balance - 20 + 120 WHERE member_id=24 AND transaction_date='2026-02-22';

-- Naph (26): 0 birdies, 32pts, 0 ladies -> sub=0, birdie_charge=220, earnings=0, total_club=220, dc=-220
UPDATE day_results SET birdie_pool=0, total_club=220, total_member=0, debtor_creditor=-220 WHERE member_id=26 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=220, balance = balance + 20 - 220 WHERE member_id=26 AND transaction_date='2026-02-22';

-- Oupa (28): 0 birdies, 34pts, 0 ladies -> sub=0, birdie_charge=220, earnings=0, total_club=220, dc=-220
UPDATE day_results SET birdie_pool=0, total_club=220, total_member=0, debtor_creditor=-220 WHERE member_id=28 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=220, balance = balance + 60 - 220 WHERE member_id=28 AND transaction_date='2026-02-22';

-- Raymond (29): 0 birdies, 33pts, 1 lady -> sub=0, lady=100, birdie_charge=220, earnings=0, total_club=320, dc=-320
UPDATE day_results SET birdie_pool=0, total_club=320, total_member=0, debtor_creditor=-320 WHERE member_id=29 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=320, balance = balance + 120 - 320 WHERE member_id=29 AND transaction_date='2026-02-22';

-- Reynold (30): 1 birdie, 31pts, 0 ladies -> sub=0, birdie_charge=200, earnings=320, total_club=200, dc=120
UPDATE day_results SET birdie_pool=320, total_club=200, total_member=320, debtor_creditor=120 WHERE member_id=30 AND game_date='2026-02-22';
UPDATE accounts SET debit=120, credit=0, balance = balance - 40 + 120 WHERE member_id=30 AND transaction_date='2026-02-22';

-- Sekete (32): 1 birdie, 33pts, 0 ladies -> sub=0, birdie_charge=200, earnings=320, total_club=200, dc=120
UPDATE day_results SET birdie_pool=320, total_club=200, total_member=320, debtor_creditor=120 WHERE member_id=32 AND game_date='2026-02-22';
UPDATE accounts SET debit=120, credit=0, balance = balance - 0 + 120 WHERE member_id=32 AND transaction_date='2026-02-22';

-- Solly (34): 2 birdies, 39pts, 0 ladies -> sub=0, birdie_charge=180, earnings=640, total_club=180, dc=460
UPDATE day_results SET birdie_pool=640, total_club=180, total_member=640, debtor_creditor=460 WHERE member_id=34 AND game_date='2026-02-22';
UPDATE accounts SET debit=460, credit=0, balance = balance - 60 + 460 WHERE member_id=34 AND transaction_date='2026-02-22';

-- Sydney (36): 0 birdies, 37pts, 0 ladies -> sub=0, birdie_charge=220, earnings=0, total_club=220, dc=-220
UPDATE day_results SET birdie_pool=0, total_club=220, total_member=0, debtor_creditor=-220 WHERE member_id=36 AND game_date='2026-02-22';
UPDATE accounts SET debit=0, credit=220, balance = balance + 40 - 220 WHERE member_id=36 AND transaction_date='2026-02-22';

-- Tebele (37): 1 birdie, 35pts, 0 ladies -> sub=0, birdie_charge=200, earnings=320, total_club=200, dc=120
UPDATE day_results SET birdie_pool=320, total_club=200, total_member=320, debtor_creditor=120 WHERE member_id=37 AND game_date='2026-02-22';
UPDATE accounts SET debit=120, credit=0, balance = balance - 20 + 120 WHERE member_id=37 AND transaction_date='2026-02-22';
