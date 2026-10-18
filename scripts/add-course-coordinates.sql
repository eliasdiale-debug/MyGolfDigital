-- Add lat/lng columns to courses table
ALTER TABLE courses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Populate coordinates for all South African golf courses
UPDATE courses SET latitude = -25.7108, longitude = 28.1566 WHERE course_id = 1;   -- Akasia
UPDATE courses SET latitude = -26.1877, longitude = 28.3225 WHERE course_id = 2;   -- Benoni Country Club
UPDATE courses SET latitude = -26.1742, longitude = 28.3106 WHERE course_id = 3;   -- Benoni Lake Club
UPDATE courses SET latitude = -26.0932, longitude = 28.0107 WHERE course_id = 4;   -- Blair Athol
UPDATE courses SET latitude = -29.1190, longitude = 26.2141 WHERE course_id = 5;   -- Bloemfontein Golf Club
UPDATE courses SET latitude = -25.9553, longitude = 28.1119 WHERE course_id = 6;   -- Blue Valley
UPDATE courses SET latitude = -25.7842, longitude = 28.7303 WHERE course_id = 7;   -- Bronkhorstspruit
UPDATE courses SET latitude = -26.0721, longitude = 28.0188 WHERE course_id = 8;   -- Bryanston
UPDATE courses SET latitude = -25.6530, longitude = 28.0070 WHERE course_id = 9;   -- Bushwillow
UPDATE courses SET latitude = -26.2741, longitude = 27.8624 WHERE course_id = 10;  -- CCJ Rocklands
UPDATE courses SET latitude = -26.2622, longitude = 27.8805 WHERE course_id = 11;  -- CCJ Woodlands
UPDATE courses SET latitude = -26.0550, longitude = 28.0992 WHERE course_id = 12;  -- CCJ Woodmead
UPDATE courses SET latitude = -25.8603, longitude = 28.1885 WHERE course_id = 13;  -- Centurion
UPDATE courses SET latitude = -28.8829, longitude = 29.3956 WHERE course_id = 14;  -- Champagne Sports
UPDATE courses SET latitude = -26.1980, longitude = 28.3031 WHERE course_id = 15;  -- CMR (State Mines area)
UPDATE courses SET latitude = -25.9450, longitude = 28.1720 WHERE course_id = 16;  -- Copperleaf
UPDATE courses SET latitude = -25.6904, longitude = 28.5231 WHERE course_id = 17;  -- Cullinan
UPDATE courses SET latitude = -25.9854, longitude = 28.0411 WHERE course_id = 18;  -- Dainfern
UPDATE courses SET latitude = -25.9850, longitude = 28.0415 WHERE course_id = 19;  -- Dainfern Blue
UPDATE courses SET latitude = -33.9910, longitude = 18.8397 WHERE course_id = 20;  -- De Zalze
UPDATE courses SET latitude = -29.8691, longitude = 30.9942 WHERE course_id = 21;  -- Durban Country Club
UPDATE courses SET latitude = -26.0335, longitude = 27.9247 WHERE course_id = 22;  -- Eagle Canyon
UPDATE courses SET latitude = -26.1554, longitude = 28.3717 WHERE course_id = 23;  -- Ebotse
UPDATE courses SET latitude = -24.5350, longitude = 30.6520 WHERE course_id = 24;  -- Elements (Hoedspruit area)
UPDATE courses SET latitude = -26.6713, longitude = 27.9355 WHERE course_id = 25;  -- Emfuleni
UPDATE courses SET latitude = -26.3047, longitude = 28.3803 WHERE course_id = 26;  -- ERPM
UPDATE courses SET latitude = -24.7628, longitude = 28.3985 WHERE course_id = 27;  -- Euphoria
UPDATE courses SET latitude = -26.5883, longitude = 27.9870 WHERE course_id = 28;  -- Eye of Africa
UPDATE courses SET latitude = -26.0185, longitude = 28.1350 WHERE course_id = 29;  -- Firethorn
UPDATE courses SET latitude = -25.7660, longitude = 27.8380 WHERE course_id = 30;  -- Gary Player (Sun City)
UPDATE courses SET latitude = -26.2198, longitude = 28.1707 WHERE course_id = 31;  -- Germiston
UPDATE courses SET latitude = -26.1695, longitude = 28.2112 WHERE course_id = 32;  -- Glendower
UPDATE courses SET latitude = -26.3100, longitude = 28.0534 WHERE course_id = 33;  -- Glenvista
UPDATE courses SET latitude = -26.7197, longitude = 26.6578 WHERE course_id = 34;  -- Goldfields West
UPDATE courses SET latitude = -33.9961, longitude = 23.4050 WHERE course_id = 35;  -- Goose Valley
UPDATE courses SET latitude = -29.5080, longitude = 30.3770 WHERE course_id = 36;  -- Gowrie Farm
UPDATE courses SET latitude = -25.4510, longitude = 31.1840 WHERE course_id = 37;  -- Graceland
UPDATE courses SET latitude = -26.6470, longitude = 28.0090 WHERE course_id = 38;  -- Heron Banks
UPDATE courses SET latitude = -26.1580, longitude = 28.0620 WHERE course_id = 39;  -- Highland
UPDATE courses SET latitude = -26.1628, longitude = 28.0576 WHERE course_id = 40;  -- Houghton
UPDATE courses SET latitude = -26.2182, longitude = 28.1290 WHERE course_id = 41;  -- Huddle Park
UPDATE courses SET latitude = -33.9850, longitude = 25.6580 WHERE course_id = 42;  -- Humewood
UPDATE courses SET latitude = -25.9071, longitude = 28.2133 WHERE course_id = 43;  -- Irene CC
UPDATE courses SET latitude = -26.0438, longitude = 27.9295 WHERE course_id = 44;  -- Jackal Creek
UPDATE courses SET latitude = -26.1065, longitude = 28.2280 WHERE course_id = 45;  -- Kempton Park
UPDATE courses SET latitude = -26.1826, longitude = 28.0298 WHERE course_id = 46;  -- Killarney
UPDATE courses SET latitude = -24.3360, longitude = 29.0490 WHERE course_id = 47;  -- Koro Creek
UPDATE courses SET latitude = -26.1099, longitude = 27.7714 WHERE course_id = 48;  -- Krugersdorp
UPDATE courses SET latitude = -26.0214, longitude = 28.0857 WHERE course_id = 49;  -- Kyalami
UPDATE courses SET latitude = -25.9735, longitude = 28.0987 WHERE course_id = 50;  -- Leeuwkop
UPDATE courses SET latitude = -25.7900, longitude = 27.8410 WHERE course_id = 51;  -- Lost City
UPDATE courses SET latitude = -26.5650, longitude = 27.9370 WHERE course_id = 52;  -- Maccauvlei
UPDATE courses SET latitude = -25.6520, longitude = 27.5410 WHERE course_id = 53;  -- Magalies
UPDATE courses SET latitude = -25.6525, longitude = 27.5415 WHERE course_id = 54;  -- Magalies Blue
UPDATE courses SET latitude = -25.6530, longitude = 27.5420 WHERE course_id = 55;  -- Magalies Red
UPDATE courses SET latitude = -26.1034, longitude = 28.1717 WHERE course_id = 56;  -- Modderfontein
UPDATE courses SET latitude = -25.5800, longitude = 27.3890 WHERE course_id = 57;  -- Mooinooi
UPDATE courses SET latitude = -26.8950, longitude = 31.9560 WHERE course_id = 58;  -- Nkonyeni
UPDATE courses SET latitude = -26.1860, longitude = 28.0765 WHERE course_id = 59;  -- Observatory
UPDATE courses SET latitude = -26.3050, longitude = 27.4540 WHERE course_id = 60;  -- Oppenheimer Park
UPDATE courses SET latitude = -33.7250, longitude = 18.9736 WHERE course_id = 61;  -- Paarl
UPDATE courses SET latitude = -26.1468, longitude = 28.0297 WHERE course_id = 62;  -- Parkview
UPDATE courses SET latitude = -33.7380, longitude = 18.9610 WHERE course_id = 63;  -- Pearl Valley
UPDATE courses SET latitude = -25.7440, longitude = 27.8670 WHERE course_id = 64;  -- Pecanwood
UPDATE courses SET latitude = -34.0440, longitude = 23.3720 WHERE course_id = 65;  -- Pezula
UPDATE courses SET latitude = -34.1770, longitude = 22.1230 WHERE course_id = 66;  -- Pinnacle Point
UPDATE courses SET latitude = -23.8990, longitude = 29.4360 WHERE course_id = 67;  -- Polokwane Golf Club
UPDATE courses SET latitude = -26.7120, longitude = 27.0990 WHERE course_id = 68;  -- Potchefstroom
UPDATE courses SET latitude = -25.7479, longitude = 28.2313 WHERE course_id = 69;  -- Pretoria Country Club
UPDATE courses SET latitude = -25.7563, longitude = 28.1862 WHERE course_id = 70;  -- Pretoria Golf Club
UPDATE courses SET latitude = -25.7458, longitude = 28.1372 WHERE course_id = 71;  -- Pretoria West
UPDATE courses SET latitude = -25.7682, longitude = 28.2940 WHERE course_id = 72;  -- Reading
UPDATE courses SET latitude = -26.7710, longitude = 27.7590 WHERE course_id = 73;  -- Riviera on Vaal
UPDATE courses SET latitude = -26.1752, longitude = 28.0819 WHERE course_id = 74;  -- Royal JHB East
UPDATE courses SET latitude = -26.1758, longitude = 28.0810 WHERE course_id = 75;  -- Royal JHB West
UPDATE courses SET latitude = -25.7420, longitude = 28.3250 WHERE course_id = 76;  -- Royal Oak
UPDATE courses SET latitude = -26.4570, longitude = 31.1990 WHERE course_id = 77;  -- Royal Swazi
UPDATE courses SET latitude = -26.0620, longitude = 27.8640 WHERE course_id = 78;  -- Ruimsig
UPDATE courses SET latitude = -25.6550, longitude = 27.2440 WHERE course_id = 79;  -- Rustenburg
UPDATE courses SET latitude = -30.8690, longitude = 30.2810 WHERE course_id = 80;  -- San Lameer
UPDATE courses SET latitude = -25.9450, longitude = 28.1730 WHERE course_id = 81;  -- Seasons
UPDATE courses SET latitude = -26.0810, longitude = 28.3390 WHERE course_id = 82;  -- Serengeti
UPDATE courses SET latitude = -25.8510, longitude = 28.1820 WHERE course_id = 83;  -- Services
UPDATE courses SET latitude = -25.8220, longitude = 28.4490 WHERE course_id = 84;  -- Silverlakes
UPDATE courses SET latitude = -33.9750, longitude = 22.4180 WHERE course_id = 85;  -- Simola
UPDATE courses SET latitude = -25.8990, longitude = 28.2010 WHERE course_id = 86;  -- Southdowns
UPDATE courses SET latitude = -22.9460, longitude = 29.9630 WHERE course_id = 87;  -- Soutpansberg
UPDATE courses SET latitude = -26.2880, longitude = 27.8590 WHERE course_id = 88;  -- Soweto Country Club
UPDATE courses SET latitude = -26.2193, longitude = 28.3810 WHERE course_id = 89;  -- State Mines
UPDATE courses SET latitude = -34.0560, longitude = 18.4350 WHERE course_id = 90;  -- Steenberg
UPDATE courses SET latitude = -33.9360, longitude = 18.8600 WHERE course_id = 91;  -- Stellenbosch
UPDATE courses SET latitude = -25.9990, longitude = 28.0220 WHERE course_id = 92;  -- Steyn City
UPDATE courses SET latitude = -34.1420, longitude = 24.8680 WHERE course_id = 93;  -- St Francis Links
UPDATE courses SET latitude = -26.8550, longitude = 27.9510 WHERE course_id = 94;  -- Vaal De Grace
UPDATE courses SET latitude = -26.1068, longitude = 28.0551 WHERE course_id = 95;  -- Wanderers
UPDATE courses SET latitude = -26.1070, longitude = 28.0555 WHERE course_id = 96;  -- Wanderers Yellow
UPDATE courses SET latitude = -25.8040, longitude = 28.2660 WHERE course_id = 97;  -- Waterkloof
UPDATE courses SET latitude = -31.0510, longitude = 29.7840 WHERE course_id = 99;  -- Wild Coast Sun
UPDATE courses SET latitude = -31.0515, longitude = 29.7845 WHERE course_id = 100; -- Wild Coast Sun Red
UPDATE courses SET latitude = -25.9860, longitude = 28.1980 WHERE course_id = 98;  -- Wingate
UPDATE courses SET latitude = -25.8150, longitude = 28.3470 WHERE course_id = 101; -- Woodhill
UPDATE courses SET latitude = -24.4920, longitude = 27.5180 WHERE course_id = 102; -- Zebula
UPDATE courses SET latitude = -29.5340, longitude = 31.2760 WHERE course_id = 103; -- Zimbali
UPDATE courses SET latitude = -25.8680, longitude = 28.1950 WHERE course_id = 104; -- Zwartkop
