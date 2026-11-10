alter table public.visits
  add column if not exists sanitation_verified boolean not null default false;
