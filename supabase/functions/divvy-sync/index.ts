// divvy-sync: Supabase Cron calls this every 30 seconds.
// 1. fetch Divvy's live station_status feed
// 2. compare it with what's in the database
// 3. upsert only the stations that changed
// 4. record the run in worker_runs (success or failure)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  changedStationRows,
  changedStatusRows,
  historyRows,
  parseInfoFeed,
  parseStatusFeed,
  type StationRow,
  type StatusRow,
} from "./sync.ts";

const STATUS_URL = "https://gbfs.lyft.com/gbfs/1.1/chi/en/station_status.json";
const INFO_URL = "https://gbfs.lyft.com/gbfs/1.1/chi/en/station_information.json";
const INFO_MAX_AGE_MS = 24 * 60 * 60 * 1000; // re-check names/locations once a day
const INFO_RETRY_MS = 10 * 60 * 1000;
const PAGE = 1000; // Supabase returns at most 1000 rows per request

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`GET ${url} -> HTTP ${res.status}`);
  return await res.json();
}

async function selectAll<T>(db: SupabaseClient, table: string, columns: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(columns).order("station_id").range(from, from + PAGE - 1);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    out.push(...(data as T[]));
    if (data.length < PAGE) return out;
  }
}

async function upsertInChunks(db: SupabaseClient, table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict: "station_id" });
    if (error) throw new Error(`upsert ${table}: ${error.message}`);
  }
}

/** Fetch station_information when we see an unknown station or once a day. Returns rows written. */
async function syncStationsIfNeeded(db: SupabaseClient, statusIds: string[]): Promise<{ known: Set<string>; synced: number }> {
  const stations = await selectAll<StationRow & { synced_at: string }>(db, "stations", "station_id,name,lat,lon,capacity,synced_at");
  const known = new Set(stations.map((s) => s.station_id));
  const newest = Math.max(0, ...stations.map((s) => Date.parse(s.synced_at)));
  const age = Date.now() - newest;
  const hasUnknown = statusIds.some((id) => !known.has(id));
  // An unknown station triggers a re-fetch, but at most every 10 minutes, so a station
  // that's in the status feed but missing from the info feed can't cause a 1 MB fetch every run.
  const due = age > INFO_MAX_AGE_MS || (hasUnknown && age > INFO_RETRY_MS);
  if (!due) return { known, synced: 0 };

  const incoming = parseInfoFeed(await fetchJson(INFO_URL));
  const current = new Map(stations.map((s) => [s.station_id, s]));
  const now = new Date().toISOString();
  const changed = changedStationRows(incoming, current).map((r) => ({ ...r, synced_at: now }));
  // Nothing changed but the daily check ran: touch one row so we wait another day.
  const toWrite = changed.length > 0 ? changed : incoming.slice(0, 1).map((r) => ({ ...r, synced_at: now }));
  await upsertInChunks(db, "stations", toWrite);
  console.log(`stations: fetched ${incoming.length}, wrote ${changed.length} new/changed`);
  for (const r of incoming) known.add(r.station_id);
  return { known, synced: changed.length };
}

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Only Cron knows the worker secret (kept in Supabase Vault). The database checks it,
  // so the secret is never in the code or in the function's settings.
  const { data: allowed, error: authError } = await db.rpc("check_worker_secret", {
    candidate: req.headers.get("x-worker-secret") ?? "",
  });
  if (authError || allowed !== true) {
    console.warn(`rejected call: ${authError?.message ?? "wrong or missing x-worker-secret"}`);
    return new Response("unauthorized", { status: 401 });
  }
  const startedAt = new Date();
  const run: Record<string, unknown> = { started_at: startedAt.toISOString() };

  try {
    const { sourceUpdatedAt, rows } = parseStatusFeed(await fetchJson(STATUS_URL));
    run.source_updated_at = sourceUpdatedAt;
    run.stations_seen = rows.length;
    console.log(`feed: ${rows.length} stations, source updated ${sourceUpdatedAt}`);

    const { known, synced } = await syncStationsIfNeeded(db, rows.map((r) => r.station_id));
    run.stations_synced = synced;

    const current = new Map(
      (await selectAll<StatusRow>(db, "station_status",
        "station_id,bikes_available,ebikes_available,docks_available,is_renting,last_reported"))
        .map((r) => [r.station_id, r]),
    );
    const changed = changedStatusRows(rows.filter((r) => known.has(r.station_id)), current);
    const changedAt = new Date().toISOString();
    await upsertInChunks(db, "station_status", changed.map((r) => ({ ...r, changed_at: changedAt })));
    run.rows_changed = changed.length;

    // Same rows into the history table, for the 24-hour trend on each card.
    const history = historyRows(changed, changedAt);
    for (let i = 0; i < history.length; i += 500) {
      const { error } = await db.from("station_history").insert(history.slice(i, i + 500));
      if (error) throw new Error(`insert station_history: ${error.message}`);
    }
    console.log(`status: ${changed.length} of ${rows.length} stations changed`);

    run.ok = true;
  } catch (err) {
    run.ok = false;
    run.error = err instanceof Error ? err.message : String(err);
    console.error(`run failed: ${run.error}`);
  }

  run.finished_at = new Date().toISOString();
  run.duration_ms = Date.now() - startedAt.getTime();
  const { error } = await db.from("worker_runs").insert(run);
  if (error) console.error(`could not record run: ${error.message}`);
  console.log(`run ${run.ok ? "ok" : "FAILED"} in ${run.duration_ms} ms`);

  return Response.json(run, { status: run.ok ? 200 : 500 });
});
