-- Optional starter data for a fresh HerbHub database.
-- Safe to run more than once. Adds a few default catalog categories the owner
-- can rename or delete; it does NOT create any patients or sample people.

insert into public.categories (kind, name, sort_order) values
  ('remedy',  'Tonics',           1),
  ('remedy',  'Baths',            2),
  ('remedy',  'Capsules & powders', 3),
  ('service', 'Charity',          1),
  ('service', 'Special requests', 2)
on conflict (kind, name) do nothing;
