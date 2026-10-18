-- Seed member handicap indices for 2024/25 season
INSERT INTO member_handicap_indices (member_id, official_handicap_index, season, number_of_differentials, effective_date) VALUES
((SELECT member_id FROM members WHERE member_name = 'Asaph Mokotjo'), 13.2, '2024/25', 178, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Avhashoni Ramikosi'), 12.8, '2024/25', 266, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Azwinndini Khampha'), 12.0, '2024/25', 224, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Basil Mukwevho'), 8.6, '2024/25', 67, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Bheki Mthethwa'), 3.3, '2024/25', 37, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Brian Mathibe'), 8.0, '2024/25', 39, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Caleb Motsamai'), 15.4, '2024/25', 63, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Dan Raselomane'), 10.2, '2024/25', 221, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Elias Diale'), 5.9, '2024/25', 63, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Hlengani Mathebula'), 12.7, '2024/25', 56, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Humbu Neswiswi'), 15.7, '2024/25', 78, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Israel Sethuntsha'), 15.6, '2024/25', 43, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Joe Ralebepa'), 17.8, '2024/25', 55, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Katiso Mhlakaza'), 18.1, '2024/25', 34, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Kgotso Lebotsa'), 17.6, '2024/25', 84, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Khathutshelo Nedzamba'), 25.2, '2024/25', 53, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Livhu Magidimisa'), 7.1, '2024/25', 167, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Livingstone Mashele'), 18.5, '2024/25', 123, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Mandla Mthethwa'), 5.2, '2024/25', 67, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Mandla Ncube'), 18.2, '2024/25', 69, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Mbuyiselo Ngcakani'), 15.4, '2024/25', 63, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Moagi Mahapa'), 17.5, '2024/25', 61, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Moeketsi Seboko'), 19.7, '2024/25', 87, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Musandiwa Mudau'), 13.2, '2024/25', 74, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Mveleli Booi'), 10.9, '2024/25', 46, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Naph Nteo'), 13.8, '2024/25', 241, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Nthumeni Wanga'), 10.5, '2024/25', 101, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Oupa Ramaswiela'), 10.1, '2024/25', 173, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Raymond Ndou'), 11.2, '2024/25', 84, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Reynold Ngobese'), 9.3, '2024/25', 178, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Sabatta Tsotetsi'), 9.7, '2024/25', 121, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Sekete Mokgehle'), 14.8, '2024/25', 73, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Shaldon Josephs'), 8.3, '2024/25', 16, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Solly Mlondobozi'), 10.7, '2024/25', 187, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Steve Mkhawane'), 19.3, '2024/25', 31, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Sydney Mhlarhi'), 14.3, '2024/25', 114, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Tebele Molata'), 11.1, '2024/25', 145, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Tebogo Mokale'), 11.5, '2024/25', 77, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Tendekai Chinyandura'), 11.2, '2024/25', 52, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Thato Mahlamvu'), 10.7, '2024/25', 140, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Tsepo Lepono'), 13.2, '2024/25', 73, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Wofhatwa Ndou'), 15.8, '2024/25', 30, '2025-01-11'),
((SELECT member_id FROM members WHERE member_name = 'Xolani Makwabe'), 21.4, '2024/25', 39, '2025-01-11');

-- Sample insert for handicap differentials (from the recent games data)
-- This will store the actual differential scores that were used to calculate the handicap index

-- Avhashoni Ramikosi differentials
INSERT INTO handicap_differentials (member_id, course_id, game_date, differential_value, gross_score) VALUES
((SELECT member_id FROM members WHERE member_name = 'Avhashoni Ramikosi'), 
 (SELECT course_id FROM courses WHERE course_name = 'Soweto Country Club'), 
 '2025-12-07', 22.5, 95),
((SELECT member_id FROM members WHERE member_name = 'Avhashoni Ramikosi'), 
 (SELECT course_id FROM courses WHERE course_name = 'Huddle Park'), 
 '2025-12-12', 12.8, NULL),
((SELECT member_id FROM members WHERE member_name = 'Avhashoni Ramikosi'), 
 (SELECT course_id FROM courses WHERE course_name = 'Reading'), 
 '2025-12-14', 20.2, NULL);

-- Add more sample differentials for other members as needed
-- Note: This is just a sample. You would insert all the differential data from the spreadsheet
