-- Divvy live tracker: tables, row-level security, Realtime.

-- 1. Stations: names and locations. Changes rarely.
create table public.stations (
  station_id  text primary key,
  name        text not null,
  lat         double precision not null,
  lon         double precision not null,
  capacity    integer,
  synced_at   timestamptz not null default now()
);

-- 2. Live status: one row per station, written by the worker only when it changes.
create table public.station_status (
  station_id        text primary key references public.stations (station_id) on delete cascade,
  bikes_available   integer not null,
  ebikes_available  integer not null,
  docks_available   integer not null,
  is_renting        boolean not null,
  last_reported     timestamptz,
  changed_at        timestamptz not null default now()
);

-- 3. What each person follows. user_id is the Clerk user id (JWT "sub").
create table public.follows (
  user_id     text not null default (auth.jwt() ->> 'sub'),
  station_id  text not null references public.stations (station_id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, station_id)
);

-- 4. One row per worker run.
create table public.worker_runs (
  id                 bigint generated always as identity primary key,
  started_at         timestamptz not null,
  finished_at        timestamptz not null default now(),
  ok                 boolean not null,
  stations_seen      integer,
  rows_changed       integer,
  stations_synced    integer,
  source_updated_at  timestamptz,
  duration_ms        integer,
  error              text
);
create index worker_runs_finished_at_idx on public.worker_runs (finished_at desc);

-- Row-level security -------------------------------------------------------
alter table public.stations       enable row level security;
alter table public.station_status enable row level security;
alter table public.follows        enable row level security;
alter table public.worker_runs    enable row level security;

-- Station data and run history are public facts: any signed-in person can read them.
-- Only the worker (secret key, which bypasses RLS) writes them.
create policy "signed-in can read stations"
  on public.stations for select to authenticated using (true);
create policy "signed-in can read station status"
  on public.station_status for select to authenticated using (true);
create policy "signed-in can read worker runs"
  on public.worker_runs for select to authenticated using (true);

-- Follows: each person sees and changes only their own rows.
create policy "read own follows"
  on public.follows for select to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);
create policy "add own follows"
  on public.follows for insert to authenticated
  with check ((auth.jwt() ->> 'sub') = user_id);
create policy "remove own follows"
  on public.follows for delete to authenticated
  using ((auth.jwt() ->> 'sub') = user_id);

-- Grants: read for signed-in users; follows also insert/delete.
revoke all on public.stations, public.station_status, public.follows, public.worker_runs from anon;
grant select on public.stations, public.station_status, public.worker_runs to authenticated;
grant select, insert, delete on public.follows to authenticated;

-- Realtime: push changes in these tables to open pages.
alter publication supabase_realtime add table public.station_status;
alter publication supabase_realtime add table public.worker_runs;

-- Realtime filters accept at most 100 ids, so cap follows at 50 per person.
create function public.limit_follows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.follows where user_id = new.user_id) >= 50 then
    raise exception 'You can follow at most 50 stations';
  end if;
  return new;
end $$;
create trigger follows_limit before insert on public.follows
  for each row execute function public.limit_follows();
