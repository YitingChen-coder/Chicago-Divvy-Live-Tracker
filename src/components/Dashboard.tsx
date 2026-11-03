"use client";

import { useMemo, useState } from "react";
import { useAlerts } from "@/lib/alerts";
import { getFreshness } from "@/lib/freshness";
import { distanceM, useGeolocation } from "@/lib/geo";
import type { MapFilter } from "@/lib/mapStyle";
import type { Station } from "@/lib/types";
import { useLiveData } from "@/lib/useLiveData";
import { useNow } from "@/lib/useNow";
import { ActivityList } from "./ActivityList";
import { CityStats } from "./CityStats";
import { FreshnessBar } from "./FreshnessBar";
import { MapView } from "./MapView";
import { NearbyView } from "./NearbyView";
import { Onboarding, useOnboarding } from "./Onboarding";
import { StationCard, StationCardSkeleton } from "./StationCard";
import { StationSearch } from "./StationSearch";
import { SystemView } from "./SystemView";
import { Toasts } from "./Toasts";

type View = "mine" | "map" | "nearby" | "system";
const VIEWS: { id: View; label: string; short: string; icon: string }[] = [
  { id: "mine", label: "My stations", short: "Mine", icon: "★" },
  { id: "map", label: "Map", short: "Map", icon: "◍" },
  { id: "nearby", label: "Near me", short: "Nearby", icon: "◎" },
  { id: "system", label: "System", short: "System", icon: "⚙" },
];

export function Dashboard() {
  const live = useLiveData();
  const { stations, statuses, follows, changes, follow, unfollow } = live;
  const loading = !stations || !follows; // a local const so TypeScript narrows both below
  const now = useNow();
  const { geo, locate } = useGeolocation();
  const alerts = useAlerts(changes, statuses, stations);
  const onboarding = useOnboarding();
  const [view, setView] = useState<View>("mine");
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const [focus, setFocus] = useState<string | null>(null);

  const freshness = getFreshness(live.latestRun, live.latestOkRun, now);
  const dimmed = freshness.state === "stale" || freshness.state === "down";
  const recent = useMemo(() => changes.filter((c) => now - c.at < 8000), [changes, now]);
  const userPos = geo.status === "ok" ? geo.position : null;

  // For a followed station that's nearly empty: the closest station within ~10 min walk with 3+ bikes.
  const alternatives = useMemo(() => {
    const out: Record<string, { station: Station; status: (typeof statuses)[string]; meters: number } | null> = {};
    if (!stations || !follows) return out;
    const all = [...stations.values()];
    for (const id of follows) {
      const here = stations.get(id);
      if (!here || (statuses[id]?.bikes_available ?? 0) > 2) continue;
      let best: (typeof out)[string] = null;
      for (const s of all) {
        const st = statuses[s.station_id];
        if (s.station_id === id || !st?.is_renting || st.bikes_available < 3) continue;
        const m = distanceM(here, s);
        if (m < 800 && (!best || m < best.meters)) best = { station: s, status: st, meters: m };
      }
      out[id] = best;
    }
    return out;
  }, [stations, follows, statuses]);

  const showOnMap = (id: string) => {
    setFocus(id);
    setView("map");
  };
  const locateAndShow = () => {
    setFocus(null);
    locate();
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <Toasts toasts={alerts.toasts} onDismiss={alerts.dismiss} />
      {onboarding.open && !loading && (
        <Onboarding stations={stations} follows={follows} onFollow={follow} onFinish={onboarding.finish} onGoTo={setView} />
      )}
      <FreshnessBar freshness={freshness} latestRun={live.latestRun} socket={live.socket} now={now} />
      <CityStats statuses={statuses} />

      <nav aria-label="Views" className="mt-6 flex gap-1 overflow-x-auto border-b border-stone-200">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            aria-current={view === v.id ? "page" : undefined}
            className={`-mb-px flex flex-1 shrink-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2.5 sm:flex-none sm:px-4 text-sm font-medium transition ${
              view === v.id ? "border-sky-600 text-sky-700" : "border-transparent text-stone-500 hover:text-stone-800"
            }`}
          >
            <span aria-hidden className="hidden sm:inline">{v.icon}</span>
            <span className="sm:hidden">{v.short}</span>
            <span className="hidden sm:inline">{v.label}</span>
            {v.id === "mine" && follows && follows.length > 0 && (
              <span className="rounded-full bg-stone-100 px-1.5 text-xs text-stone-600">{follows.length}</span>
            )}
          </button>
        ))}
        <button
          onClick={onboarding.show}
          className="-mb-px ml-auto hidden shrink-0 items-center gap-1 border-b-2 border-transparent px-3 py-2.5 text-sm text-stone-500 hover:text-stone-800 sm:flex"
        >
          <span aria-hidden>?</span> Guide
        </button>
      </nav>

      {live.error && (
        <div role="alert" className="mt-4 flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{live.error}</span>
          <button onClick={live.clearError} className="font-medium underline">Dismiss</button>
        </div>
      )}

      {view === "map" && !loading && (
        <MapView
          stations={stations}
          statuses={statuses}
          follows={follows}
          filter={mapFilter}
          setFilter={setMapFilter}
          focus={focus}
          userPos={userPos}
          onLocate={locateAndShow}
          locating={geo.status === "locating"}
          onFollow={follow}
          onUnfollow={unfollow}
        />
      )}

      {view === "nearby" && !loading && (
        <NearbyView
          stations={stations}
          statuses={statuses}
          follows={follows}
          geo={geo}
          onLocate={locate}
          onFollow={follow}
          onShowOnMap={showOnMap}
        />
      )}

      {view === "system" && <SystemView runs={live.runs} now={now} socket={live.socket} lastPushAt={live.lastPushAt} />}

      {(view === "mine" || (loading && view !== "system")) && (
        <>
          <section className="mt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Your stations</h2>
                <p className="text-sm text-stone-500">
                  {loading ? "Loading…" : follows.length === 0 ? "Pick stations to watch." : `${follows.length} followed · updates appear here on their own`}
                  <button onClick={onboarding.show} className="ml-2 text-sky-700 underline sm:hidden">
                    How it works
                  </button>
                </p>
              </div>
              <StationSearch stations={stations} follows={follows ?? []} onFollow={follow} disabled={loading} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {loading && Array.from({ length: 3 }, (_, i) => <StationCardSkeleton key={i} />)}

              {!loading && follows.length === 0 && <EmptyState stations={stations} onFollow={follow} />}

              {!loading &&
                follows.map((id) => {
                  const st = stations.get(id);
                  return (
                    <StationCard
                      key={id}
                      station={st}
                      status={statuses[id]}
                      change={recent.find((c) => c.station_id === id)}
                      dimmed={dimmed}
                      now={now}
                      distanceM={userPos && st ? distanceM(userPos, st) : null}
                      history={live.history[id]}
                      alertOn={alerts.watched.includes(id)}
                      alternative={alternatives[id] ?? null}
                      onToggleAlert={() => alerts.toggle(id)}
                      onUnfollow={() => unfollow(id)}
                      onShowOnMap={() => showOnMap(id)}
                    />
                  );
                })}
            </div>
            {!loading && follows.length > 0 && <MoreSuggestions stations={stations} follows={follows} onFollow={follow} />}
          </section>

          {!loading && follows.length > 0 && <ActivityList changes={changes} stations={stations} now={now} />}
        </>
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

function suggestedStations(stations: Map<string, Station>, follows: string[]): Station[] {
  const byName = new Map([...stations.values()].map((s) => [s.name, s]));
  return SUGGESTED.map((n) => byName.get(n)).filter((s): s is Station => !!s && !follows.includes(s.station_id));
}

function SuggestionChips({ picks, onFollow }: { picks: Station[]; onFollow: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {picks.map((s) => (
        <button
          key={s.station_id}
          onClick={() => onFollow(s.station_id)}
          className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm hover:border-sky-500 hover:bg-sky-50"
        >
          + {s.name}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ stations, onFollow }: { stations: Map<string, Station>; onFollow: (id: string) => void }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
      <p className="text-base font-medium">You aren&apos;t following any stations yet.</p>
      <p className="mt-1 text-sm text-stone-500">
        Search above, or start with a busy one. Busy stations change every few minutes.
      </p>
      <div className="mt-5 flex justify-center">
        <SuggestionChips picks={suggestedStations(stations, [])} onFollow={onFollow} />
      </div>
    </div>
  );
}

/** Shown until someone follows 3 stations, so the first visit has something that moves. */
function MoreSuggestions({ stations, follows, onFollow }: { stations: Map<string, Station>; follows: string[]; onFollow: (id: string) => void }) {
  const picks = suggestedStations(stations, follows).slice(0, 4);
  if (follows.length >= 3 || picks.length === 0) return null;
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm text-stone-500">Busy stations you could add:</p>
      <SuggestionChips picks={picks} onFollow={onFollow} />
    </div>
  );
}
