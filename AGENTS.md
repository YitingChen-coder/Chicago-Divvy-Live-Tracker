# AGENTS.md — Divvy Live Tracker

Live Chicago Divvy station tracker (MPCS 51238 Assignment 5).

## System
- **Source:** Divvy GBFS `station_status.json` (ttl 60 s) and `station_information.json`. No key.
- **Worker:** Supabase Edge Function `supabase/functions/divvy-sync` (Deno). Supabase Cron calls it every 30 s with an `x-worker-secret` header (`verify_jwt = false`), checked against Vault by `public.check_worker_secret()`. It upserts only stations whose bikes / e-bikes / docks / `is_renting` changed (not `last_reported` alone) and writes one row per run to `worker_runs`.
- **Database:** `stations`, `station_status`, `follows` (RLS: `user_id = auth.jwt()->>'sub'`), `worker_runs`. Migrations in `supabase/migrations/`.
- **Page:** Next.js 16 (App Router, `src/proxy.ts` instead of middleware) + Tailwind 4 + Clerk 7 (`<Show when=…>`, not `<SignedIn>`). Supabase client in `src/lib/supabase.ts` sends the Clerk session token (Clerk ↔ Supabase third-party auth).
- **Freshness:** `src/lib/freshness.ts` — loading / fresh / stale (> ~3 missed runs or Divvy feed > 5 min old) / down (latest run failed).

Data-flow chart: `docs/data-flow.md`.

## Commands
- `npm run dev` — local page (needs `.env.local`, see `.env.example`)
- `npm test` — page freshness tests (node:test)
- `npm run test:worker` — worker tests on saved Divvy responses (Deno, via npx)
- `npm run build` — production build; `supabase/` is excluded in tsconfig and eslint

## Rules
- Never put the Supabase secret / service-role key or the worker secret in the repo. The function gets the key from Supabase; the worker secret lives only in Vault.
- Keep writes minimal: Realtime bills every change sent to every open page.
- Commits and PRs list only the repo owner as author — no AI co-author or "Generated with" lines.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
