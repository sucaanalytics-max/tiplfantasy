-- Seed howstat IDs for players missed in migration 013
-- Found by searching howstat.com/Cricket/Statistics/IPL/PlayerList.asp

-- Well-known IPL veterans
UPDATE players SET howstat_id = 4387 WHERE name = 'Shreyas Iyer' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 3889 WHERE name = 'Ajinkya Rahane' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4738 WHERE name = 'Varun Chakravarthy' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4393 WHERE name = 'Shardul Thakur' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4759 WHERE name = 'Prithvi Shaw' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4777 WHERE name = 'Jofra Archer' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 3998 WHERE name = 'Jason Holder' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4930 WHERE name = 'Prasidh Krishna' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4414 WHERE name = 'Mustafizur Rahman' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4609 WHERE name = 'Lockie Ferguson' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4429 WHERE name = 'Mitchell Santner' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7209 WHERE name = 'Nitish Kumar Reddy' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4665 WHERE name = 'Rinku Singh' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6922 WHERE name = 'Will Jacks' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4605 WHERE name = 'Rovman Powell' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4826 WHERE name = 'Finn Allen' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4657 WHERE name = 'Shashank Singh' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5863 WHERE name = 'Abdul Samad' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6082 WHERE name = 'Nathan Ellis' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4937 WHERE name = 'Prabhsimran Singh' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6507 WHERE name = 'Mukesh Choudhary' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5660 WHERE name = 'Tom Banton' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5774 WHERE name = 'Kyle Jamieson' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4636 WHERE name = 'Lungi Ngidi' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 3839 WHERE name = 'Adam Milne' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4257 WHERE name = 'Matt Henry' AND howstat_id IS NULL;

-- More experienced players
UPDATE players SET howstat_id = 6544 WHERE name = 'Kuldeep Sen' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5856 WHERE name = 'Kartik Tyagi' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6533 WHERE name = 'Akash Deep' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6921 WHERE name = 'Luke Wood' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7755 WHERE name = 'Manav Suthar' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4838 WHERE name = 'Sherfane Rutherford' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4772 WHERE name = 'Mayank Markande' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7663 WHERE name = 'Xavier Bartlett' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7237 WHERE name = 'Vyshak Vijaykumar' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5662 WHERE name = 'Romario Shepherd' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4768 WHERE name = 'Shivam Mavi' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7224 WHERE name = 'Nehal Wadhera' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 8307 WHERE name = 'Priyansh Arya' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 8309 WHERE name = 'Suryansh Shedge' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4678 WHERE name = 'Vishnu Vinod' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7229 WHERE name = 'Yash Thakur' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6521 WHERE name = 'Arshad Khan' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7760 WHERE name = 'Anshul Kamboj' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6508 WHERE name = 'Prashant Solanki' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6528 WHERE name = 'Raj Bawa' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7754 WHERE name = 'Robin Minz' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5935 WHERE name = 'Akeal Hosein' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 8222 WHERE name = 'Corbin Bosch' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6552 WHERE name = 'Ryan Rickelton' AND howstat_id IS NULL;

-- Alternate name matches
UPDATE players SET howstat_id = 4696 WHERE name = 'Wanindu Hasaranga' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5972 WHERE name = 'Arjun Tendulkar' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4946 WHERE name = 'Himmat Singh' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4559 WHERE name = 'Pravin Dubey' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4942 WHERE name = 'Rasikh Salam Dar' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 6665 WHERE name = 'Jamie Overton' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 8031 WHERE name = 'Jacob Bethell' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7203 WHERE name = 'Matthew Short' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4827 WHERE name = 'Kamindu Mendis' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 4378 WHERE name = 'Shreyas Gopal' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7757 WHERE name = 'Vaibhav Suryavanshi' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7779 WHERE name = 'Kwena Maphaka' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 8398 WHERE name = 'Mitch Owen' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7239 WHERE name = 'Gurnoor Brar' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 7752 WHERE name = 'Kumar Kushagra' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 5859 WHERE name = 'Akash Singh' AND howstat_id IS NULL;
UPDATE players SET howstat_id = 3126 WHERE name = 'Nuwan Thushara' AND howstat_id IS NULL;

-- Players NOT found on howstat (truly uncapped/new or listed under unknown names):
-- Sarfaraz Khan (CSK), Sai Kishore (GT), Mayank Yadav (LSG), Prince Yadav (LSG),
-- Urvil Patel (CSK), Ben Dwarshuis (PBKS), Brydon Carse (SRH), Cooper Connolly (PBKS),
-- Ashwani Kumar (MI), Musheer Khan (PBKS), Danish Malewar (MI), Suyash Sharma (RCB),
-- Mangesh Yadav (RCB), Mukul Choudhary (LSG), Jitesh Sharma (RCB), Jordan Cox (RCB),
-- Pathum Nissanka (DC), Donovan Ferreira (RR), Lhuan-dre Pretorius (RR),
-- Sushant Mishra (RR), Vicky Ostwal (RCB), Atharva Ankolekar (MI)
