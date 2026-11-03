# Chicago Divvy Live Tracker

A real-time Chicago Divvy bike availability tracker with personalized station favorites, Supabase Realtime, and scheduled data updates.

Sign in, follow the stations you care about, and watch bikes, e-bikes and open docks change without refreshing.

- **Live app:** _Vercel URL_
- **Data-flow chart:** [docs/data-flow.md](docs/data-flow.md)

## How it works

```
Divvy GBFS feed ──► Edge Function divvy-sync ──► Postgres ──► Realtime ──► Next.js page
 (every 60 s)        (Supabase Cron, every 30 s)   (only changed rows)   (WebSocket)   (Vercel, Clerk sign-in)
```

1. **Supabase Cron** calls the `divvy-sync` Edge Function every 30 seconds.
2. The worker fetches `station_status.json`, compares each station's bikes / e-bikes / docks / renting flag with the database, and **upserts only the stations that changed**. In a 3-minute sample, 1,119 of 2,079 stations checked in but only 80 actually changed, so comparing counts instead of timestamps cuts writes about 14×.
3. Every run, successful or not, adds a row to `worker_runs`.
4. **Supabase Realtime** pushes each changed `station_status` row, and each new `worker_runs` row, to open pages. Each page subscribes only to the stations that person follows.
5. The page shows how fresh the data is:

| State | When | What you see |
|---|---|---|
| Loading | first queries haven't returned | skeleton cards, grey "Connecting…" |
| Fresh | last successful run < ~105 s ago | green "Live" + "Checked Divvy 12s ago · next check in ~18s" |
| Stale | no successful run for ~3 intervals, or Divvy's own feed > 5 min old | amber bar, cards dimmed, "Numbers may not match the dock" |
| Down | the most recent run failed | red bar with the error, time of last good data, "retries every 30s" |

## Personal follows and security

- `follows(user_id, station_id)` has row-level security: you can read, add and remove only rows where `user_id` equals your Clerk user id (`auth.jwt()->>'sub'`).
- Station data and run history are readable by any signed-in user and writable only by the worker, which uses the Supabase secret key on Supabase's servers.
- Realtime needs three things, and all three are in the first migration: the table in the `supabase_realtime` publication, a `select` grant, and an RLS policy.

## Tests

- `npm run test:worker`: runs the worker's logic on **saved copies of the real Divvy feed** taken 3 minutes apart (`supabase/functions/divvy-sync/fixtures/`). It checks that:
  - a first run saves every station
  - the same feed twice saves nothing
  - only the 3 stations whose counts changed are saved, not the 2 that only checked in
  - a station closing counts as a change
  - a malformed station is skipped
  - a broken feed throws, so the run is recorded as failed
- `npm test`: checks the page's loading / fresh / stale / down logic.

## Run it yourself

1. Copy `.env.example` to `.env.local` and fill in the Clerk and Supabase keys.
2. Apply `supabase/migrations/*.sql`, deploy `supabase/functions/divvy-sync`, set its `WORKER_SECRET`, and create the Vault secrets `project_url` and `worker_secret`.
3. In Supabase → Authentication → Third-party auth, add Clerk. In Clerk, turn on the Supabase integration.
4. `npm install && npm run dev`

## Free-tier budget

- Edge Function calls: 2 per minute → ~86,400 a month, out of 500,000.
- Realtime messages: only changed rows are written, and each page receives changes only for the stations it follows.
- `worker_runs` is pruned to the last 3 days by a second cron job.

## Stack

Next.js 16 · Tailwind CSS 4 · Clerk · Supabase (Postgres, Realtime, Edge Functions, Cron) · Vercel
