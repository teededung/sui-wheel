-- Wheels and entries schema
-- Tables:
--   wheels: one row per created wheel
--   wheel_entries: ordered list of entries for each wheel

create table if not exists public.wheels (
  id uuid primary key default gen_random_uuid(),
  wheel_id text not null,                -- on-chain wheel object id
  tx_digest text not null,               -- creation tx digest
  package_id text not null,              -- move package id
  organizer_address text not null,       -- wallet that created the wheel
  prizes_mist bigint[] not null,         -- list of prize amounts in mist
  total_donation_mist numeric(78,0) null, -- total donation in mist (can exceed bigint)
  network text not null default 'testnet',
  created_at timestamptz not null default now(),
  unique (wheel_id)
);

create index if not exists wheels_organizer_idx on public.wheels(organizer_address);
create index if not exists wheels_created_at_idx on public.wheels(created_at desc);

-- Ordered entries for each wheel
create table if not exists public.wheel_entries (
  id bigserial primary key,
  wheel_id text not null references public.wheels(wheel_id) on delete cascade,
  entry_address text not null,
  entry_index integer not null,          -- preserves exact order
  created_at timestamptz not null default now(),
  unique (wheel_id, entry_index)
);

create index if not exists wheel_entries_wheel_idx on public.wheel_entries(wheel_id);
create index if not exists wheel_entries_address_idx on public.wheel_entries(entry_address);

-- Minimal RLS for read access; write via service role only from server endpoints
alter table public.wheels enable row level security;
alter table public.wheel_entries enable row level security;

-- Allow public read
create policy "wheels read" on public.wheels
  for select using (true);

create policy "wheel_entries read" on public.wheel_entries
  for select using (true);

-- No insert/update/delete policies; require service role


