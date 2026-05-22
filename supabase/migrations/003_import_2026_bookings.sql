-- Scotland Escape — Bulk import 2026 bookings (Freddy + Dolly)
-- Source: 2026 Campervan Rota - Rota.csv
-- Run this in the Supabase SQL Editor
--
-- NOTE: "Ellie" bookings are NOT included — Ellie is not yet in the vans table.
--       15 Ellie bookings exist in the rota (see bottom of this file).
--       Add Ellie as a van first, then run the separate Ellie insert below.
--
-- Equipment-only bookings (Rebecca Bach, Levi Kiwi) are also excluded.

INSERT INTO bookings (
  id, type, van_id, client_name, guests,
  start_date, end_date, notes, deposit_amount, deposit_collected
)
SELECT
  gen_random_uuid(),
  'van',
  v.id,
  b.client_name,
  b.guests::integer,
  b.start_date::date,
  b.end_date::date,
  b.notes,
  b.deposit_amount::numeric,
  b.deposit_collected::boolean
FROM (VALUES

  -- ── Dolly ──────────────────────────────────────────────────────────────────
  ('Dolly', 'Tim',                     1, '2026-01-16', '2026-01-19', 'Goboony. Pet cleaning fee £40 (paid on Goboony)',                                              0,    'false'),
  ('Dolly', 'Mila',                    1, '2026-01-25', '2026-01-30', 'Website. Early collection £50, city centre transfer £50',                                   1500, 'true'),
  ('Dolly', 'Pamela',                  1, '2026-01-30', '2026-02-01', 'Direct',                                                                                       0,    'false'),
  ('Dolly', 'Bethany Alexander',       1, '2026-02-12', '2026-02-16', 'Website',                                                                                      0,    'false'),
  ('Dolly', 'Malcolm',                 1, '2026-02-19', '2026-02-22', 'Direct',                                                                                       0,    'false'),
  ('Dolly', 'Neve',                    1, '2026-02-22', '2026-02-26', 'Goboony. Late drop off - to be paid direct',                                                   0,    'false'),
  ('Dolly', 'Kirsten Hunter',          1, '2026-02-28', '2026-03-05', 'Website. Excess reduction to £750, pet cleaning fee',                                         0,    'false'),
  ('Dolly', 'Joanna',                  1, '2026-03-06', '2026-03-09', 'Goboony',                                                                                      0,    'false'),
  ('Dolly', 'Amy Dearberg',            1, '2026-03-21', '2026-03-28', 'Website. Pet cleaning fee, early collection fee',                                           1500, 'true'),
  ('Dolly', 'Julie Murphy',            1, '2026-03-28', '2026-04-03', 'Goboony. Additional driver - paid',                                                            0,    'false'),
  ('Dolly', 'Vikki',                   1, '2026-04-03', '2026-04-06', 'Goboony',                                                                                      0,    'false'),
  ('Dolly', 'Brittany',                1, '2026-04-06', '2026-04-17', 'Goboony. Additional driver to pay £15',                                                        0,    'false'),
  ('Dolly', 'Neal Fiske',              1, '2026-04-25', '2026-05-02', 'Website. Portable toilet, additional driver',                                               1500, 'true'),
  ('Dolly', 'Tim Beckett',             1, '2026-05-05', '2026-05-11', 'Website. Portable toilet, midge repellent, midge net, BBQ & coals, outdoor shower & tent', 1500, 'true'),
  ('Dolly', 'Katherina',               4, '2026-05-12', '2026-06-02', 'Website. Child seat x2, stone chip & tyre protection, airport/Glasgow transfers both ways',1500, 'false'),
  ('Dolly', 'Julie Holroyd',           2, '2026-06-06', '2026-06-13', 'Website. Stone chip & tyre protection, pet cleaning fee',                                     0,    'false'),
  ('Dolly', 'Morgane Blanchard',       2, '2026-06-15', '2026-06-20', 'Website. Camping chairs, outdoor shower, 10L water canister',                                 0,    'false'),
  ('Dolly', 'Robin Favre-Verand',      2, '2026-06-23', '2026-07-01', 'Goboony',                                                                                      0,    'false'),
  ('Dolly', 'Anna Hopcroft',           3, '2026-07-04', '2026-07-15', 'Website. Additional driver, portable toilet, midge net (2 adults & 1 child)',                 0,    'false'),
  ('Dolly', 'Albert Farre de Diego',   3, '2026-07-15', '2026-08-06', 'Website. Child seat, portable toilet, camping chairs, 10L water canister',                    0,    'false'),
  ('Dolly', 'John',                    1, '2026-08-07', '2026-08-10', 'Personal (text)',                                                                              0,    'false'),
  ('Dolly', 'Stuart McCall',           2, '2026-08-10', '2026-08-24', 'Goboony. Glasgow transfer £50',                                                               0,    'false'),
  ('Dolly', 'Duncan Shaw',             2, '2026-08-29', '2026-09-05', 'Website. Additional driver',                                                                   0,    'false'),
  ('Dolly', 'Adrian Blount',           2, '2026-09-05', '2026-09-10', 'Website. Excess reduction, pet cleaning fee, portable toilet, 10L water canister',            0,    'false'),
  ('Dolly', 'Oliver Cruddas',          2, '2026-09-12', '2026-09-21', 'Website. Portable toilet',                                                                    0,    'false'),
  ('Dolly', 'Donna Jones',             2, '2026-09-21', '2026-10-02', 'Website. Additional driver, excess reduction, camping chairs x2, portable toilet, BBQ & coals', 0, 'false'),
  ('Dolly', 'Joan',                    2, '2026-10-02', '2026-10-17', 'Goboony',                                                                                      0,    'false'),
  ('Dolly', 'Charlotte Trussler',      2, '2026-11-12', '2026-11-16', 'Website. Additional driver, early pick up',                                                   0,    'false'),

  -- ── Freddy ─────────────────────────────────────────────────────────────────
  ('Freddy', 'Tracey',                 1, '2026-02-13', '2026-02-17', 'Goboony',                                                                                      0,    'false'),
  ('Freddy', 'Sophie Dearberg',        1, '2026-03-21', '2026-03-28', 'Website. Pet cleaning fee, early collection fee',                                           1500, 'true'),
  ('Freddy', 'Neil McCall',            1, '2026-03-28', '2026-04-02', 'Website. Going to drop keys on 1st',                                                          0,    'false'),
  ('Freddy', 'Sarah Jane',             1, '2026-04-03', '2026-04-07', 'Goboony',                                                                                      0,    'false'),
  ('Freddy', 'George Gregory',         1, '2026-04-10', '2026-04-17', 'Website',                                                                                      0,    'false'),
  ('Freddy', 'Jonas Rasim',            1, '2026-04-25', '2026-05-01', 'Website. Excess reduction, stone & chip protection',                                        1500, 'true'),
  ('Freddy', 'Thomas Duffy',           2, '2026-05-01', '2026-05-09', 'Website. Late drop off - 7pm',                                                              1500, 'true'),
  ('Freddy', 'Solene',                 2, '2026-05-10', '2026-05-23', 'Website. Additional driver, camping chairs x2, outdoor shower & tent, 10L water jug',      1500, 'false'),
  ('Freddy', 'Nimish Vidyadhar Ojale', 2, '2026-05-24', '2026-06-02', 'Website. Excess reduction, stone chip & tyre protection',                                    0,    'false'),
  ('Freddy', 'Rachel Parsons',         2, '2026-06-05', '2026-06-11', 'Website. Additional driver, stone chip & tyre protection, midge net',                        0,    'false'),
  ('Freddy', 'Rana Aktas',             2, '2026-06-12', '2026-06-17', 'Website',                                                                                      0,    'false'),
  ('Freddy', 'Maude Paquin',           2, '2026-07-07', '2026-07-17', 'Website. Airport transfers GLA, early collection, additional driver, portable toilet, 10L water canister', 0, 'false'),
  ('Freddy', 'Olivia Torley',          2, '2026-07-17', '2026-07-20', 'Direct (Influencer). Free rental',                                                            0,    'false'),
  ('Freddy', 'Gabriel Dillet',         2, '2026-07-22', '2026-07-29', 'Goboony. Early check-in/late drop off £100 to pay',                                           0,    'false'),
  ('Freddy', 'Yorick Croiset',         2, '2026-08-01', '2026-08-06', 'Website. Additional driver, late drop off',                                                   0,    'false'),
  ('Freddy', 'Borja Lopez Arranz',     2, '2026-08-06', '2026-08-16', 'Website. Additional driver, excess reduction, camping chairs x2',                             0,    'false'),
  ('Freddy', 'Guerric',                2, '2026-08-17', '2026-08-22', 'Goboony',                                                                                      0,    'false'),
  ('Freddy', 'Mary Reeves',            1, '2026-09-25', '2026-10-01', 'Website',                                                                                      0,    'false')

) AS b(van_name, client_name, guests, start_date, end_date, notes, deposit_amount, deposit_collected)
JOIN vans v ON v.name = b.van_name;


-- Ellie bookings omitted — van discontinued, all bookings cancelled.
