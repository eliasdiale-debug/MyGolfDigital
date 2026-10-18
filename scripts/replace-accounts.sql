-- Clear existing accounts data
TRUNCATE TABLE accounts RESTART IDENTITY;

-- Insert all member transactions (member accounts only, skipping org accounts)
-- Format: (member_id, transaction_date, course_id, description, debit, credit)

-- Opening balances (01-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(1, '2026-01-01', 'Opening balances', 0, 10221.27),
(2, '2026-01-01', 'Opening balances', 276.50, 0),
(3, '2026-01-01', 'Opening balances', 0, 3836.91),
(4, '2026-01-01', 'Opening balances', 0, 3409.17),
(5, '2026-01-01', 'Opening balances', 0, 961.21),
(6, '2026-01-01', 'Opening balances', 0, 1464.73),
(7, '2026-01-01', 'Opening balances', 0, 3752.67),
(8, '2026-01-01', 'Opening balances', 0, 5026.80),
(9, '2026-01-01', 'Opening balances', 0, 1201.00),
(10, '2026-01-01', 'Opening balances', 0, 5185.89),
(11, '2026-01-01', 'Opening balances', 0, 2196.19),
(12, '2026-01-01', 'Opening balances', 0, 417.48),
(13, '2026-01-01', 'Opening balances', 0, 1191.41),
(14, '2026-01-01', 'Opening balances', 0, 0),
(15, '2026-01-01', 'Opening balances', 341.70, 0),
(16, '2026-01-01', 'Opening balances', 0, 1799.89),
(17, '2026-01-01', 'Opening balances', 0, 17227.05),
(18, '2026-01-01', 'Opening balances', 0, 1516.60),
(19, '2026-01-01', 'Opening balances', 0, 722.50),
(20, '2026-01-01', 'Opening balances', 2141.70, 0),
(21, '2026-01-01', 'Opening balances', 267.65, 0),
(22, '2026-01-01', 'Opening balances', 979.75, 0),
(23, '2026-01-01', 'Opening balances', 0, 133.90),
(24, '2026-01-01', 'Opening balances', 0, 241.05),
(25, '2026-01-01', 'Opening balances', 0, 0),
(26, '2026-01-01', 'Opening balances', 0, 1001.45),
(27, '2026-01-01', 'Opening balances', 0, 9596.67),
(28, '2026-01-01', 'Opening balances', 0, 5198.23),
(29, '2026-01-01', 'Opening balances', 0, 4692.50),
(30, '2026-01-01', 'Opening balances', 0, 1288.00),
(31, '2026-01-01', 'Opening balances', 0, 7425.86),
(32, '2026-01-01', 'Opening balances', 0, 4230.00),
(33, '2026-01-01', 'Opening balances', 371.39, 0),
(34, '2026-01-01', 'Opening balances', 0, 16750.97),
(35, '2026-01-01', 'Opening balances', 0, 287.47),
(36, '2026-01-01', 'Opening balances', 0, 16015.27),
(37, '2026-01-01', 'Opening balances', 0, 590.54),
(38, '2026-01-01', 'Opening balances', 0, 0),
(39, '2026-01-01', 'Opening balances', 28.07, 0),
(40, '2026-01-01', 'Opening balances', 0, 7684.71),
(41, '2026-01-01', 'Opening balances', 0, 4417.16),
(42, '2026-01-01', 'Opening balances', 0, 0),
(43, '2026-01-01', 'Opening balances', 0, 1340.00);

-- Membership fee payments received (01-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(3, '2026-01-01', 'Membership fee payment', 0, 2650.00),
(8, '2026-01-01', 'Membership fee payment', 0, 2650.00),
(11, '2026-01-01', 'Membership fee payment', 0, 3500.00),
(41, '2026-01-01', 'Membership fee payment', 0, 2650.00),
(36, '2026-01-01', 'Membership fee payment', 0, 2650.00);

-- 2026 membership fees charged (01-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(1, '2026-01-01', '2026 membership', 2900.00, 0),
(2, '2026-01-01', '2026 membership', 2900.00, 0),
(3, '2026-01-01', '2026 membership', 2900.00, 0),
(4, '2026-01-01', '2026 membership', 2900.00, 0),
(5, '2026-01-01', '2026 membership', 2900.00, 0),
(7, '2026-01-01', '2026 membership', 2900.00, 0),
(8, '2026-01-01', '2026 membership', 2900.00, 0),
(9, '2026-01-01', '2026 membership', 2900.00, 0),
(10, '2026-01-01', '2026 membership', 2900.00, 0),
(11, '2026-01-01', '2026 membership', 2900.00, 0),
(12, '2026-01-01', '2026 membership', 2900.00, 0),
(13, '2026-01-01', '2026 membership', 2900.00, 0),
(17, '2026-01-01', '2026 membership', 2900.00, 0),
(18, '2026-01-01', '2026 membership', 2900.00, 0),
(19, '2026-01-01', '2026 membership', 2900.00, 0),
(20, '2026-01-01', '2026 membership', 2900.00, 0),
(21, '2026-01-01', '2026 membership', 2900.00, 0),
(22, '2026-01-01', '2026 membership', 2900.00, 0),
(23, '2026-01-01', '2026 membership', 2900.00, 0),
(24, '2026-01-01', '2026 membership', 2900.00, 0),
(26, '2026-01-01', '2026 membership', 2900.00, 0),
(27, '2026-01-01', '2026 membership', 2900.00, 0),
(28, '2026-01-01', '2026 membership', 2900.00, 0),
(29, '2026-01-01', '2026 membership', 2900.00, 0),
(30, '2026-01-01', '2026 membership', 2900.00, 0),
(31, '2026-01-01', '2026 membership', 2900.00, 0),
(32, '2026-01-01', '2026 membership', 2900.00, 0),
(34, '2026-01-01', '2026 membership', 2900.00, 0),
(36, '2026-01-01', '2026 membership', 2900.00, 0),
(37, '2026-01-01', '2026 membership', 2900.00, 0),
(38, '2026-01-01', '2026 membership', 2900.00, 0),
(39, '2026-01-01', '2026 membership', 2900.00, 0),
(40, '2026-01-01', '2026 membership', 2900.00, 0),
(41, '2026-01-01', '2026 membership', 2900.00, 0),
(42, '2026-01-01', '2026 membership', 2900.00, 0),
(43, '2026-01-01', '2026 membership', 2900.00, 0);

-- Kyalami Country Club (02-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-02', 'Kyalami - Sins', 60.00, 60.00),
(3, '2026-01-02', 'Kyalami - Sins', 60.00, 0),
(4, '2026-01-02', 'Kyalami - Sins', 140.00, 0),
(13, '2026-01-02', 'Kyalami - Sins', 110.00, 110.00),
(26, '2026-01-02', 'Kyalami - Sins', 40.00, 40.00),
(30, '2026-01-02', 'Kyalami - Sins', 80.00, 0),
(26, '2026-01-02', 'Kyalami - CashBank', 14.00, 0);

-- Glenvista (04-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-04', 'Glenvista - Sins', 60.00, 0),
(3, '2026-01-04', 'Glenvista - Sins', 170.00, 0),
(4, '2026-01-04', 'Glenvista - Sins', 40.00, 0),
(5, '2026-01-04', 'Glenvista - Sins', 90.00, 0),
(9, '2026-01-04', 'Glenvista - Sins', 70.00, 0),
(17, '2026-01-04', 'Glenvista - Sins', 160.00, 488.00),
(19, '2026-01-04', 'Glenvista - Sins', 40.00, 0),
(26, '2026-01-04', 'Glenvista - Sins', 60.00, 60.00),
(29, '2026-01-04', 'Glenvista - Sins', 340.00, 0),
(32, '2026-01-04', 'Glenvista - Sins', 60.00, 40.00),
(37, '2026-01-04', 'Glenvista - Sins', 40.00, 0),
(38, '2026-01-04', 'Glenvista - Sins', 90.00, 0),
(37, '2026-01-04', 'Glenvista - CashBank', 100.00, 0);

-- Sekete/Sydney transfer (05-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(32, '2026-01-05', 'sydney', 400.00, 0),
(36, '2026-01-05', 'sekete', 0, 400.00);

-- Bank deposits (05-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(29, '2026-01-05', 'Bank deposit', 0, 5000.00),
(19, '2026-01-05', 'Bank deposit', 0, 2500.00),
(43, '2026-01-05', 'Bank deposit', 0, 1600.00);

-- Gary Player Country Club (07-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(3, '2026-01-07', 'Gary Player - Sins', 60.00, 0),
(10, '2026-01-07', 'Gary Player - Sins', 40.00, 0),
(11, '2026-01-07', 'Gary Player - Sins', 350.00, 0),
(27, '2026-01-07', 'Gary Player - Sins', 40.00, 0),
(28, '2026-01-07', 'Gary Player - Sins', 190.00, 0),
(29, '2026-01-07', 'Gary Player - Sins', 70.00, 0);

-- Waterkloof (09-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-09', 'Waterkloof - Sins', 120.00, 0),
(3, '2026-01-09', 'Waterkloof - Sins', 270.00, 0),
(4, '2026-01-09', 'Waterkloof - Sins', 140.00, 0),
(8, '2026-01-09', 'Waterkloof - Sins', 120.00, 275.00),
(15, '2026-01-09', 'Waterkloof - Sins', 170.00, 0),
(26, '2026-01-09', 'Waterkloof - Sins', 100.00, 100.00),
(28, '2026-01-09', 'Waterkloof - Sins', 270.00, 0),
(34, '2026-01-09', 'Waterkloof - Sins', 120.00, 0),
(36, '2026-01-09', 'Waterkloof - Sins', 100.00, 0),
(40, '2026-01-09', 'Waterkloof - Sins', 80.00, 0),
(41, '2026-01-09', 'Waterkloof - Sins', 140.00, 0);

-- Bank deposits (09-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(15, '2026-01-09', 'Bank deposit', 0, 500.00),
(30, '2026-01-09', 'Ngobs refund credit', 1288.00, 0);

-- Bank deposits (10-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(30, '2026-01-10', 'Bank deposit', 0, 80.00);

-- Services (11-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(1, '2026-01-11', 'Services - Sins', 140.00, 0),
(3, '2026-01-11', 'Services - Sins', 40.00, 40.00),
(4, '2026-01-11', 'Services - Sins', 40.00, 0),
(8, '2026-01-11', 'Services - Sins', 160.00, 150.00),
(31, '2026-01-11', 'Services - Sins', 60.00, 0),
(8, '2026-01-11', 'Services - CashBank', 14.00, 0);

-- Jackals Creek (11-Jan-26 game, 16-Jan-26 sins)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(4, '2026-01-16', 'Jackals Creek - Sins', 80.00, 100.00),
(8, '2026-01-16', 'Jackals Creek - Sins', 100.00, 356.00),
(9, '2026-01-16', 'Jackals Creek - Sins', 80.00, 0),
(15, '2026-01-16', 'Jackals Creek - Sins', 150.00, 200.00),
(26, '2026-01-16', 'Jackals Creek - Sins', 80.00, 90.00),
(27, '2026-01-16', 'Jackals Creek - Sins', 180.00, 0),
(29, '2026-01-16', 'Jackals Creek - Sins', 100.00, 0),
(43, '2026-01-16', 'Jackals Creek - Sins', 150.00, 0);

-- Jackals Creek greenfees (11-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(9, '2026-01-11', 'Jackals Creek greenfee', 515.00, 0),
(43, '2026-01-11', 'Jackals Creek greenfee', 515.00, 0),
(29, '2026-01-11', 'Jackals Creek greenfee', 515.00, 0),
(4, '2026-01-11', 'Jackals Creek greenfee', 515.00, 0),
(26, '2026-01-11', 'Jackals Creek greenfee', 515.00, 0),
(15, '2026-01-11', 'Jackals Creek greenfee', 515.00, 0),
(27, '2026-01-11', 'Jackals Creek greenfee', 515.00, 0),
(8, '2026-01-11', 'Jackals Creek greenfee', 0, 3605.00);

-- Bank deposits (12-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(38, '2026-01-12', 'Bank deposit', 0, 90.00);

-- Bank deposits (16-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(15, '2026-01-16', 'Bank deposit', 0, 1000.00),
(26, '2026-01-16', 'Bank deposit', 0, 2500.00);

-- Bank deposits (17-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(43, '2026-01-17', 'Bank deposit', 0, 500.00);

-- ERPM (18-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(1, '2026-01-18', 'ERPM - Sins', 60.00, 100.00),
(2, '2026-01-18', 'ERPM - Sins', 230.00, 100.00),
(3, '2026-01-18', 'ERPM - Sins', 100.00, 0),
(8, '2026-01-18', 'ERPM - Sins', 60.00, 314.00),
(17, '2026-01-18', 'ERPM - Sins', 80.00, 0),
(30, '2026-01-18', 'ERPM - Sins', 100.00, 0),
(31, '2026-01-18', 'ERPM - Sins', 180.00, 0),
(34, '2026-01-18', 'ERPM - Sins', 60.00, 0),
(36, '2026-01-18', 'ERPM - Sins', 280.00, 0),
(8, '2026-01-18', 'ERPM - CashBank', 54.00, 0);

-- ERPM greenfees (18-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(36, '2026-01-18', 'ERPM greenfee', 335.00, 0),
(17, '2026-01-18', 'ERPM greenfee', 335.00, 0),
(2, '2026-01-18', 'ERPM greenfee', 335.00, 0),
(30, '2026-01-18', 'ERPM greenfee', 0, 1005.00);

-- Bank deposit (19-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-19', 'Bank deposit', 0, 156.50);

-- Bank deposit (20-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(13, '2026-01-20', 'Bank deposit', 0, 3000.00);

-- Randpark Firethorn (23-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-23', 'Firethorn - Sins', 60.00, 136.00),
(9, '2026-01-23', 'Firethorn - Sins', 60.00, 0),
(17, '2026-01-23', 'Firethorn - Sins', -120.00, 0),
(18, '2026-01-23', 'Firethorn - Sins', 210.00, 0),
(26, '2026-01-23', 'Firethorn - Sins', 60.00, 60.00),
(30, '2026-01-23', 'Firethorn - Sins', 60.00, 0),
(34, '2026-01-23', 'Firethorn - Sins', 160.00, 0);

-- Bank deposits (23-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-23', 'Bank deposit', 0, 300.00),
(9, '2026-01-23', 'Bank deposit', 0, 3000.00);

-- Caddy transfer (25-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(32, '2026-01-25', 'caddy', 400.00, 0),
(36, '2026-01-25', 'caddy', 0, 400.00);

-- Dainfern Sins (25-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(1, '2026-01-25', 'Dainfern - Sins', 160.00, 500.00),
(2, '2026-01-25', 'Dainfern - Sins', 120.00, 0),
(4, '2026-01-25', 'Dainfern - Sins', 140.00, 0),
(8, '2026-01-25', 'Dainfern - Sins', 160.00, 300.00),
(9, '2026-01-25', 'Dainfern - Sins', 120.00, 0),
(13, '2026-01-25', 'Dainfern - Sins', 310.00, 0),
(17, '2026-01-25', 'Dainfern - Sins', 160.00, 0),
(19, '2026-01-25', 'Dainfern - Sins', 240.00, 0),
(26, '2026-01-25', 'Dainfern - Sins', 160.00, 570.00),
(27, '2026-01-25', 'Dainfern - Sins', 260.00, 0),
(29, '2026-01-25', 'Dainfern - Sins', 160.00, 0),
(30, '2026-01-25', 'Dainfern - Sins', 210.00, 0),
(32, '2026-01-25', 'Dainfern - Sins', 160.00, 0),
(34, '2026-01-25', 'Dainfern - Sins', 160.00, 0),
(36, '2026-01-25', 'Dainfern - Sins', 280.00, 0),
(37, '2026-01-25', 'Dainfern - Sins', 140.00, 600.00),
(40, '2026-01-25', 'Dainfern - Sins', 160.00, 0),
(42, '2026-01-25', 'Dainfern - Sins', 160.00, 0),
(43, '2026-01-25', 'Dainfern - Sins', 190.00, 0),
(37, '2026-01-25', 'Dainfern - CashBank', 590.00, 0);

-- Dainfern visitor/transfer (25-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(36, '2026-01-25', 'Dainfern visitor fee', 460.00, 0),
(2, '2026-01-25', 'Dainfern AVH/Syd transfer', 0, 100.00);

-- Dainfern greenfees (25-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(1, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(2, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(4, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(8, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(9, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(13, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(17, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(19, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(26, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(27, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(29, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(30, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(32, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(34, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(36, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(37, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(40, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(42, '2026-01-25', 'Dainfern greenfee', 460.00, 0),
(43, '2026-01-25', 'Dainfern greenfee', 460.00, 0);

-- Sydney/Avhashoni transfer (25-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(36, '2026-01-25', 'AVH bet', 100.00, 0);

-- Bank deposits (26-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(4, '2026-01-26', 'Bank deposit', 0, 1000.00),
(8, '2026-01-26', 'Bank deposit', 0, 400.00);

-- Bank deposits (27-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(43, '2026-01-27', 'Bank deposit', 0, 800.00);

-- Killarney (30-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-30', 'Killarney - Sins', 180.00, 100.00),
(3, '2026-01-30', 'Killarney - Sins', 110.00, 0),
(4, '2026-01-30', 'Killarney - Sins', 60.00, 100.00),
(9, '2026-01-30', 'Killarney - Sins', 60.00, 0),
(28, '2026-01-30', 'Killarney - Sins', 40.00, 0),
(41, '2026-01-30', 'Killarney - Sins', 20.00, 0),
(2, '2026-01-30', 'Killarney - CashBank', 12.00, 0);

-- Nthumeni/Khathu transfer (30-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(16, '2026-01-30', 'Nthumeni transfer', 1799.89, 0),
(27, '2026-01-30', 'Khathu transfer', 0, 1799.89);

-- Bank deposit (30-Jan-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-01-30', 'Bank deposit', 0, 390.00);

-- Krugersdorp (01-Feb-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(1, '2026-02-01', 'Krugersdorp - Sins', 60.00, 0),
(3, '2026-02-01', 'Krugersdorp - Sins', 80.00, 0),
(8, '2026-02-01', 'Krugersdorp - Sins', 160.00, 0),
(15, '2026-02-01', 'Krugersdorp - Sins', 160.00, 0),
(18, '2026-02-01', 'Krugersdorp - Sins', 310.00, 0),
(27, '2026-02-01', 'Krugersdorp - Sins', 60.00, 0),
(29, '2026-02-01', 'Krugersdorp - Sins', 180.00, 0);

-- Bank deposit (02-Feb-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(33, '2026-02-02', 'Bank deposit', 0, 400.00);

-- Bank deposit (03-Feb-26)
INSERT INTO accounts (member_id, transaction_date, description, debit, credit) VALUES
(2, '2026-02-03', 'Bank deposit', 0, 600.00);

-- Now compute per-member running balances
-- Balance = cumulative (debit - credit) per member ordered by date and account_id
UPDATE accounts a
SET balance = sub.running_balance
FROM (
  SELECT account_id,
    SUM(COALESCE(debit, 0) - COALESCE(credit, 0)) OVER (
      PARTITION BY member_id 
      ORDER BY transaction_date, account_id
    ) AS running_balance
  FROM accounts
) sub
WHERE a.account_id = sub.account_id;
