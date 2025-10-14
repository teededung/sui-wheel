-- Winners per spin
create table if not exists public.wheel_winners (
  id bigserial primary key,
  wheel_id text not null references public.wheels(wheel_id) on delete cascade,
  winner_address text not null,
  prize_index integer not null,
  spin_tx_digest text not null,
  spin_time timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (wheel_id, prize_index),
  unique (spin_tx_digest)
);

create index if not exists wheel_winners_wheel_idx on public.wheel_winners(wheel_id);
create index if not exists wheel_winners_address_idx on public.wheel_winners(winner_address);

alter table public.wheel_winners enable row level security;
create policy "wheel_winners read" on public.wheel_winners
  for select using (true);


