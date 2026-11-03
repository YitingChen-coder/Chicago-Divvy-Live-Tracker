"use client";

import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkerRun } from "./freshness";
import { useSupabase } from "./supabase";
import type { HistoryPoint, LiveChange, Station, StationStatus } from "./types";

const RUN_COLUMNS = "id,finished_at,ok,rows_changed,stations_seen,source_updated_at,error,duration_ms";
const STATUS_COLUMNS = "station_id,bikes_available,ebikes_available,docks_available,is_renting,last_reported,changed_at";
const PAGE = 1000; // Supabase returns at most 1000 rows per request

async function selectAll<T>(run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

async function loadLatestRuns(db: SupabaseClient) {
  const [latest, latestOk] = await Promise.all([
    db.from("worker_runs").select(RUN_COLUMNS).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("worker_runs").select(RUN_COLUMNS).eq("ok", true).order("finished_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (latest.error) throw latest.error;
  if (latestOk.error) throw latestOk.error;
  return { latest: latest.data as WorkerRun | null, latestOk: latestOk.data as WorkerRun | null };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RUN_HISTORY = 60; // last 30 minutes of runs, for the System view
type HistoryRow = { station_id: string; bikes_available: number; ebikes_available: number; docks_available: number; recorded_at: string };
const toPoint = (at: string, r: { bikes_available: number; ebikes_available: number; docks_available: number }): HistoryPoint => ({
  t: Date.parse(at),
  bikes: r.bikes_available,
  ebikes: r.ebikes_available,
  docks: r.docks_available,
});

const message = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

/**
 * Everything the page shows, kept up to date:
 * - stations I follow: pushed by Realtime the moment the worker writes them
 * - every other station (for the map): after each worker run, fetch only rows
 *   whose changed_at is newer than what we have
 * - worker runs: pushed by Realtime, for the freshness bar
 */
export function useLiveData() {
  const db = useSupabase();
  const [stations, setStations] = useState<Map<string, Station> | null>(null);
  const [statuses, setStatuses] = useState<Record<string, StationStatus>>({});
  const [follows, setFollows] = useState<string[] | null>(null);
  const [latestRun, setLatestRun] = useState<WorkerRun | null | undefined>(undefined);
  const [latestOkRun, setLatestOkRun] = useState<WorkerRun | null | undefined>(undefined);
  const [changes, setChanges] = useState<LiveChange[]>([]);
  const [history, setHistory] = useState<Record<string, HistoryPoint[]>>({});
  const [runs, setRuns] = useState<WorkerRun[] | null>(null);
  const [lastPushAt, setLastPushAt] = useState<number | null>(null);
  const [socket, setSocket] = useState("connecting");
  const [error, setError] = useState<string | null>(null);

  const statusesRef = useRef(statuses);
  const followsRef = useRef<string[]>([]);
  const newestChangeRef = useRef<string>("1970-01-01T00:00:00Z");
  useEffect(() => {
    statusesRef.current = statuses;
    followsRef.current = follows ?? [];
  }, [statuses, follows]);

  /**
   * Store new rows. For stations I follow, also record what changed, whether the
   * row arrived by Realtime or by a catch-up fetch (whichever comes first).
   */
  const mergeStatuses = useCallback((rows: StationStatus[]) => {
    if (rows.length === 0) return;
    const seen: LiveChange[] = [];
    for (const r of rows) {
      if (r.changed_at > newestChangeRef.current) newestChangeRef.current = r.changed_at;
      const prev = statusesRef.current[r.station_id];
      if (prev && prev.changed_at !== r.changed_at && followsRef.current.includes(r.station_id)) {
        seen.push({
          key: `${r.station_id}-${r.changed_at}`,
          station_id: r.station_id,
          at: Date.now(),
          bikesDelta: r.bikes_available - prev.bikes_available,
          docksDelta: r.docks_available - prev.docks_available,
          closed: prev.is_renting && !r.is_renting,
          reopened: !prev.is_renting && r.is_renting,
        });
      }
    }
    const next = { ...statusesRef.current };
    for (const r of rows) next[r.station_id] = r;
    statusesRef.current = next; // so a second merge in the same tick compares against this one
    setStatuses(next);
    if (seen.length) {
      setChanges((c) => [...seen, ...c].slice(0, 12));
      // Extend the 24-hour trend of each followed station that changed.
      setHistory((h) => {
        const next = { ...h };
        for (const c of seen) {
          const r = rows.find((x) => x.station_id === c.station_id)!;
          next[c.station_id] = [...(next[c.station_id] ?? []), toPoint(r.changed_at, r)];
        }
        return next;
      });
    }
  }, []);

  /** Only the rows that changed since the newest one we've seen. */
  const catchUp = useCallback(async () => {
    if (!db) return;
    try {
      const rows = await selectAll<StationStatus>((a, b) =>
        db.from("station_status").select(STATUS_COLUMNS).gt("changed_at", newestChangeRef.current).order("station_id").range(a, b),
      );
      mergeStatuses(rows);
    } catch (e) {
      setError(message(e));
    }
  }, [db, mergeStatuses]);

  // 1. First load.
  useEffect(() => {
    if (!db) return;
    (async () => {
      try {
        const [all, status, myFollows, runs, recentRuns] = await Promise.all([
          selectAll<Station>((a, b) => db.from("stations").select("station_id,name,lat,lon,capacity").order("name").range(a, b)),
          selectAll<StationStatus>((a, b) => db.from("station_status").select(STATUS_COLUMNS).order("station_id").range(a, b)),
          db.from("follows").select("station_id").order("created_at"),
          loadLatestRuns(db),
          db.from("worker_runs").select(RUN_COLUMNS).order("finished_at", { ascending: false }).limit(RUN_HISTORY),
        ]);
        if (myFollows.error) throw myFollows.error;
        if (recentRuns.error) throw recentRuns.error;
        setRuns(recentRuns.data as WorkerRun[]);
        mergeStatuses(status);
        setStations(new Map(all.map((s) => [s.station_id, s])));
        setFollows(myFollows.data.map((f) => f.station_id));
        setLatestRun(runs.latest);
        setLatestOkRun(runs.latestOk);
      } catch (e) {
        setError(message(e));
      }
    })();
  }, [db, mergeStatuses]);

  // 2. Realtime for the stations I follow, plus their last 24 hours for the trend lines.
  const followKey = follows?.join(",") ?? "";
  useEffect(() => {
    if (!db || !followKey) return;
    let cancelled = false;
    (async () => {
      const since = new Date(Date.now() - DAY_MS).toISOString();
      try {
        const rows = await selectAll<HistoryRow>((a, b) =>
          db.from("station_history").select("station_id,bikes_available,ebikes_available,docks_available,recorded_at")
            .in("station_id", followKey.split(",")).gte("recorded_at", since).order("recorded_at").range(a, b),
        );
        if (cancelled) return;
        const byStation: Record<string, HistoryPoint[]> = {};
        for (const r of rows) (byStation[r.station_id] ??= []).push(toPoint(r.recorded_at, r));
        setHistory(byStation);
      } catch (e) {
        if (!cancelled) setError(message(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db, followKey]);

  useEffect(() => {
    if (!db || !followKey) return;
    const channel = db
      .channel(`status:${followKey.length}:${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "station_status", filter: `station_id=in.(${followKey})` },
        (payload: RealtimePostgresChangesPayload<StationStatus>) => {
          const next = payload.new as StationStatus;
          if (next?.station_id) mergeStatuses([next]);
        },
      )
      // Catch up once the subscription is live, so nothing between load and subscribe is missed.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") catchUp();
      });
    return () => {
      db.removeChannel(channel);
    };
  }, [db, followKey, mergeStatuses, catchUp]);

  // 3. Realtime for worker runs; each successful run with changes refreshes the map.
  useEffect(() => {
    if (!db) return;
    const channel = db
      .channel("worker-runs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs" }, (payload) => {
        const run = payload.new as WorkerRun;
        setLastPushAt(Date.now());
        setRuns((r) => (r ? [run, ...r].slice(0, RUN_HISTORY) : r));
        setLatestRun(run);
        if (run.ok) setLatestOkRun(run);
        if (run.ok && run.rows_changed) catchUp();
      })
      .subscribe((status) => setSocket(status));
    return () => {
      db.removeChannel(channel);
    };
  }, [db, catchUp]);

  // 4. A tab left in the background can miss pushes: catch up when it's visible again.
  useEffect(() => {
    if (!db) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      catchUp();
      const runs = await loadLatestRuns(db).catch(() => null);
      if (runs) {
        setLatestRun(runs.latest);
        setLatestOkRun(runs.latestOk);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [db, catchUp]);

  const follow = useCallback(
    async (id: string) => {
      if (!db || !follows || follows.includes(id)) return;
      setFollows([...follows, id]);
      const { error } = await db.from("follows").insert({ station_id: id });
      if (error) {
        setFollows((f) => f?.filter((x) => x !== id) ?? null);
        setError(error.message.includes("at most") ? error.message : `Couldn't follow: ${error.message}`);
      }
    },
    [db, follows],
  );

  const unfollow = useCallback(
    async (id: string) => {
      if (!db || !follows) return;
      const before = follows;
      setFollows(follows.filter((x) => x !== id));
      const { error } = await db.from("follows").delete().eq("station_id", id);
      if (error) {
        setFollows(before);
        setError(`Couldn't unfollow: ${error.message}`);
      }
    },
    [db, follows],
  );

  return {
    stations,
    statuses,
    follows,
    latestRun,
    latestOkRun,
    changes,
    history,
    runs,
    lastPushAt,
    socket,
    error,
    clearError: () => setError(null),
    follow,
    unfollow,
    loading: !stations || !follows,
  };
}
