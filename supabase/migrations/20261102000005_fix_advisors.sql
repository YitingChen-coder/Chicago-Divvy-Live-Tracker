-- Fixes from Supabase's security and performance advisors.

-- 1. limit_follows() is only for the trigger; nobody should call it through the API.
revoke execute on function public.limit_follows() from public, anon, authenticated;

-- 2. Evaluate auth.jwt() once per query instead of once per row.
alter policy "read own follows" on public.follows
  using ((select auth.jwt() ->> 'sub') = user_id);
alter policy "add own follows" on public.follows
  with check ((select auth.jwt() ->> 'sub') = user_id);
alter policy "remove own follows" on public.follows
  using ((select auth.jwt() ->> 'sub') = user_id);

-- 3. Index the foreign key so deleting a station doesn't scan follows.
create index follows_station_id_idx on public.follows (station_id);

-- Not changed: pg_net sits in the public schema ("extension_in_public" warning).
-- Moving it means dropping and recreating the extension the cron job depends on;
-- its functions live in the "net" schema anyway, so it adds nothing to the API.
