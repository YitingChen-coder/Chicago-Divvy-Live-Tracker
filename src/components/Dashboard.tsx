"use client";

import type { RealtimePostgresChangesPayload, SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getFreshness, type WorkerRun } from "@/lib/freshness";
import { useSupabase } from "@/lib/supabase";
import type { LiveChange, Station, StationStatus } from "@/lib/types";
import { useNow } from "@/lib/useNow";
import { ActivityList } from "./ActivityList";
import { FreshnessBar } from "./FreshnessBar";
import { StationCard, StationCardSkeleton } from "./StationCard";
import { StationSearch } from "./StationSearch";

const RUN_COLUMNS = "id,finished_at,ok,rows_changed,stations_seen,source_updated_at,error";
const STATUS_COLUMNS = "station_id,bikes_available,ebikes_available,docks_available,is_renting,last_reported,changed_at";

async function loadAllStations(db: SupabaseClient): Promise<Station[]> {
  const out: Station[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("stations").select("station_id,name,capacity").order("name").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
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

export function Dashboard() {
  const db = useSupabase();
  const now = useNow();

  const [stations, setStations] = useState<Map<string, Station> | null>(null);
  const [follows, setFollows] = useState<string[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, StationStatus>>({});
  const [latestRun, setLatestRun] = useState<WorkerRun | null | undefined>(undefined);
  const [latestOkRun, setLatestOkRun] = useState<WorkerRun | null | undefined>(undefined);
  const [changes, setChanges] = useState<LiveChange[]>([]);
  const [socket, setSocket] = useState<string>("connecting");
  const [error, setError] = useState<string | null>(null);
  const statusesRef = useRef(statuses);
  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  // 1. First load: stations, my follows, the latest worker runs.
  useEffect(() => {
    if (!db) return;
    (async () => {
      try {
        const [all, myFollows, runs] = await Promise.all([
          loadAllStations(db),
          db.from("follows").select("station_id").order("created_at"),
          loadLatestRuns(db),
        ]);
        if (myFollows.error) throw myFollows.error;
        setStations(new Map(all.map((s) => [s.station_id, s])));
        setFollows(myFollows.data.map((f) => f.station_id));
        setLatestRun(runs.latest);
        setLatestOkRun(runs.latestOk);
      } catch (e) {
        setError(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));
      }
    })();
  }, [db]);

  // 2. Status for the stations I follow, and a Realtime subscription for just those ids.
  const followKey = follows?.join(",") ?? "";
  const refreshStatuses = useCallback(async () => {
    if (!db || !followKey) return;
    const { data, error } = await db.from("station_status").select(STATUS_COLUMNS).in("station_id", followKey.split(","));
    if (error) return setError(error.message);
    setStatuses(Object.fromEntries(data.map((s) => [s.station_id, s as StationStatus])));
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
          if (!next?.station_id) return;
          const prev = statusesRef.current[next.station_id];
          setStatuses((s) => ({ ...s, [next.station_id]: next }));
          if (prev) {
            setChanges((c) =>
              [
                {
                  key: `${next.station_id}-${next.changed_at}`,
                  station_id: next.station_id,
                  at: Date.now(),
                  bikesDelta: next.bikes_available - prev.bikes_available,
                  docksDelta: next.docks_available - prev.docks_available,
                  closed: prev.is_renting && !next.is_renting,
                  reopened: !prev.is_renting && next.is_renting,
                },
                ...c,
              ].slice(0, 12),
            );
          }
        },
      )
      // Load current values once the subscription is live, so nothing that changes
      // between the load and the subscription is missed.
      .subscribe((status) => {
        if (status === "SUBSCRIBED") refreshStatuses();
      });
    return () => {
      db.removeChannel(channel);
    };
  }, [db, followKey, refreshStatuses]);

  // 3. Every worker run, for the freshness bar.
  useEffect(() => {
    if (!db) return;
    const channel = db
      .channel("worker-runs")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "worker_runs" }, (payload) => {
        const run = payload.new as WorkerRun;
        setLatestRun(run);
        if (run.ok) setLatestOkRun(run);
      })
      .subscribe((status) => setSocket(status));
    return () => {
      db.removeChannel(channel);
    };
  }, [db]);

  // 4. A tab left in the background can miss pushes: catch up when it's visible again.
  useEffect(() => {
    if (!db) return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      refreshStatuses();
      const runs = await loadLatestRuns(db).catch(() => null);
      if (runs) {
        setLatestRun(runs.latest);
        setLatestOkRun(runs.latestOk);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [db, refreshStatuses]);

  const follow = async (id: string) => {
    if (!db || !follows || follows.includes(id)) return;
    setFollows([...follows, id]);
    const { error } = await db.from("follows").insert({ station_id: id });
    if (error) {
      setFollows((f) => f?.filter((x) => x !== id) ?? null);
      setError(error.message.includes("at most") ? error.message : `Couldn't follow: ${error.message}`);
    }
  };

  const unfollow = async (id: string) => {
    if (!db || !follows) return;
    const before = follows;
    setFollows(follows.filter((x) => x !== id));
    const { error } = await db.from("follows").delete().eq("station_id", id);
    if (error) {
      setFollows(before);
      setError(`Couldn't unfollow: ${error.message}`);
    }
  };

  const freshness = getFreshness(latestRun, latestOkRun, now);
  const dimmed = freshness.state === "stale" || freshness.state === "down";
  const loading = !stations || !follows;
  const recent = useMemo(() => changes.filter((c) => now - c.at < 8000), [changes, now]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
      <FreshnessBar freshness={freshness} latestRun={latestRun} socket={socket} now={now} />

      {error && (
        <div role="alert" className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-medium underline">Dismiss</button>
        </div>
      )}

      <section className="mt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Your stations</h2>
            <p className="text-sm text-stone-500">
              {loading ? "Loading…" : follows.length === 0 ? "Pick stations to watch." : `${follows.length} followed · updates appear here on their own`}
            </p>
          </div>
          <StationSearch stations={stations} follows={follows ?? []} onFollow={follow} disabled={loading} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading &&
            Array.from({ length: 3 }, (_, i) => <StationCardSkeleton key={i} />)}

          {!loading && follows.length === 0 && (
            <EmptyState stations={stations} onFollow={follow} />
          )}

          {!loading &&
            follows.map((id) => (
              <StationCard
                key={id}
                station={stations.get(id)}
                status={statuses[id]}
                change={recent.find((c) => c.station_id === id)}
                dimmed={dimmed}
                now={now}
                onUnfollow={() => unfollow(id)}
              />
            ))}
        </div>
      </section>

      {!loading && follows.length > 0 && (
        <ActivityList changes={changes} stations={stations} now={now} />
      )}
    </div>
  );
}

const SUGGESTED = [
  "University Ave & 57th St",
  "Ellis Ave & 60th St",
  "Canal St & Adams St",
  "Clinton St & Washington Blvd",
  "Kingsbury St & Kinzie St 1",
  "DuSable Lake Shore Dr & Monroe St",
];

function EmptyState({ stations, onFollow }: { stations: Map<string, Station>; onFollow: (id: string) => void }) {
  const byName = new Map([...stations.values()].map((s) => [s.name, s]));
  const picks = SUGGESTED.map((n) => byName.get(n)).filter((s): s is Station => !!s);
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <p className="text-base font-medium">You aren&apos;t following any stations yet.</p>
      <p className="mt-1 text-sm text-stone-500">
        Search above, or start with a busy one. Busy stations change every few minutes.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {picks.map((s) => (
          <button
            key={s.station_id}
            onClick={() => onFollow(s.station_id)}
            className="rounded-full border border-stone-300 px-3 py-1.5 text-sm hover:border-sky-500 hover:bg-sky-50"
          >
            + {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}
