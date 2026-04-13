-- Add bowling style classification to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS bowling_style TEXT DEFAULT 'unknown';

-- Pace bowlers (fast / fast-medium / medium-fast)
UPDATE players SET bowling_style = 'pace' WHERE name IN (
  'Jasprit Bumrah',        -- RF, MI
  'Mohammed Shami',        -- RF, LSG
  'Kagiso Rabada',         -- RF, GT
  'Mohammed Siraj',        -- RF, GT
  'Prasidh Krishna',       -- RF, GT
  'Jofra Archer',          -- RF, RR
  'Nandre Burger',         -- RF, RR
  'Sandeep Sharma',        -- RFM, RR
  'Tushar Deshpande',      -- RFM, RR
  'Lungi Ngidi',           -- RF, DC
  'T Natarajan',           -- LF, DC
  'Mukesh Kumar',          -- RFM, DC
  'Bhuvneshwar Kumar',     -- RFM, RCB
  'Jacob Duffy',           -- RFM, RCB
  'Josh Hazlewood',        -- RF, RCB
  'Rasikh Salam Dar',      -- RF, RCB
  'Arshdeep Singh',        -- LF, PBKS
  'Xavier Bartlett',       -- RF, PBKS
  'Vyshak Vijaykumar',     -- RFM, PBKS
  'Vaibhav Arora',         -- RFM, KKR
  'Blessing Muzarabani',   -- RF, KKR
  'Kartik Tyagi',          -- RF, KKR
  'Anshul Kamboj',         -- RFM, CSK
  'Matt Henry',            -- RF, CSK
  'Khaleel Ahmed',         -- LF, CSK
  'Gurjapneet Singh',      -- LF, CSK
  'Trent Boult',           -- LF, MI
  'Deepak Chahar',         -- RFM, MI
  'Harshal Patel',         -- RFM, SRH
  'Jaydev Unadkat',        -- LFM, SRH
  'David Payne',           -- LFM, SRH
  'Shivam Mavi',           -- RF, SRH
  'Eshan Malinga',         -- RF, SRH
  'Prince Yadav',          -- RFM, LSG
  'Avesh Khan',            -- RF, LSG
  'Mohsin Khan',           -- LF, LSG
  'Anrich Nortje',         -- RF, LSG
  'Ashok Sharma',          -- RFM, GT
  'Shivang Kumar'          -- RFM, SRH
);

-- Spin bowlers (off-spin / leg-spin / left-arm orthodox / wrist-spin)
UPDATE players SET bowling_style = 'spin' WHERE name IN (
  'Ravi Bishnoi',          -- Leg-spin, RR
  'Rashid Khan',           -- Leg-spin, GT
  'Yuzvendra Chahal',      -- Leg-spin, PBKS
  'Kuldeep Yadav',         -- Left-arm wrist-spin, DC
  'Sunil Narine',          -- Off-spin/mystery, KKR
  'Varun Chakravarthy',    -- Mystery spin, KKR
  'Krunal Pandya',         -- Left-arm orthodox, RCB
  'Suyash Sharma',         -- Leg-spin, RCB
  'Axar Patel',            -- Left-arm orthodox, DC
  'Ravindra Jadeja',       -- Left-arm orthodox, RR
  'Washington Sundar',     -- Off-spin, GT
  'Mitchell Santner',      -- Left-arm orthodox, MI
  'AM Ghazanfar',          -- Leg-spin, MI
  'Mayank Markande',       -- Leg-spin, MI
  'Rahul Chahar',          -- Leg-spin, CSK
  'Noor Ahmad',            -- Left-arm wrist-spin, CSK
  'Akeal Hosein',          -- Left-arm orthodox, CSK
  'Anukul Roy',            -- Left-arm orthodox, KKR
  'Manimaran Siddharth',   -- Left-arm orthodox, LSG
  'Digvesh Rathi',         -- Left-arm orthodox, LSG
  'Harsh Dubey',           -- Off-spin, SRH
  'Vipraj Nigam',          -- Off-spin, DC
  'Auqib Nabi Dar',        -- Left-arm orthodox, DC
  'Brijesh Sharma'         -- Leg-spin, RR
);

-- All-rounders: classify by their bowling style
UPDATE players SET bowling_style = 'pace' WHERE name IN (
  'Hardik Pandya',         -- RFM, MI
  'Shardul Thakur',        -- RFM, MI
  'Jamie Overton',         -- RF, CSK
  'Marco Jansen',          -- LF, PBKS
  'Romario Shepherd',      -- RFM, RCB
  'Corbin Bosch',          -- RFM, MI
  'Cameron Green',         -- RFM, KKR
  'Nitish Kumar Reddy'     -- RFM, SRH
);

UPDATE players SET bowling_style = 'spin' WHERE name IN (
  'Abhishek Sharma',       -- Left-arm orthodox, SRH
  'Shahbaz Ahmed',         -- Left-arm orthodox, LSG
  'Aiden Markram',         -- Off-spin, LSG
  'Shivam Dube',           -- Medium/Off-spin, CSK
  'Abhinandan Singh'       -- Off-spin, RCB
);

-- Part-timers: classify best-effort
UPDATE players SET bowling_style = 'spin' WHERE name IN (
  'Riyan Parag',           -- Leg-spin (part-time), RR
  'Abdul Samad',           -- Leg-spin (part-time), LSG
  'Matthew Short'          -- Off-spin (part-time), CSK
);

UPDATE players SET bowling_style = 'pace' WHERE name IN (
  'Shashank Singh',        -- Medium pace (part-time), PBKS
  'Marcus Stoinis',        -- Medium pace (part-time), PBKS
  'Tim David'              -- Medium pace (part-time), RCB
);
