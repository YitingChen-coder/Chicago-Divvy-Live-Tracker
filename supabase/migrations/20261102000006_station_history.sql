-- One row each time a station's counts change, for the 24-hour trend on each card.
create table public.station_history (
  id                bigint generated always as identity primary key,
  station_id        text not null references public.stations (station_id) on delete cascade,
  bikes_available   integer not null,
  ebikes_available  integer not null,
  docks_available   integer not null,
  is_renting        boolean not null,
  recorded_at       timestamptz not null default now()
);
create index station_history_station_time_idx on public.station_history (station_id, recorded_at desc);

alter table public.station_history enable row level security;
create policy "signed-in can read station history"
  on public.station_history for select to authenticated using (true);
revoke all on public.station_history from anon;
grant select on public.station_history to authenticated;
-- Not added to Realtime: the page appends points from station_status pushes itself.

-- Start every station's history with its current value.
insert into public.station_history (station_id, bikes_available, ebikes_available, docks_available, is_renting, recorded_at)
select station_id, bikes_available, ebikes_available, docks_available, is_renting, changed_at from public.station_status;

-- Keep two days.
select cron.schedule(
  'prune-station-history',
  '23 * * * *',
  $$ delete from public.station_history where recorded_at < now() - interval '2 days' $$
);
