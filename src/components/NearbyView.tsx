"use client";

import { useMemo, useState } from "react";
import { directionsUrl, distanceM, formatDistance, walkMinutes, type GeoState, type LatLon } from "@/lib/geo";
import { AVAILABILITY_STYLE } from "@/lib/mapStyle";
import { availability, type Station, type StationStatus } from "@/lib/types";

type Need = "bike" | "ebike" | "dock";
const NEEDS: { id: Need; label: string }[] = [
  { id: "bike", label: "I need a bike" },
  { id: "ebike", label: "I want an e-bike" },
  { id: "dock", label: "I need to return one" },
];

export function NearbyView({
  stations,
  statuses,
  follows,
  geo,
  onLocate,
  onFollow,
  onShowOnMap,
}: {
  stations: Map<string, Station>;
  statuses: Record<string, StationStatus>;
  follows: string[];
  geo: GeoState;
  onLocate: () => void;
  onFollow: (id: string) => void;
  onShowOnMap: (id: string) => void;
}) {
  const [need, setNeed] = useState<Need>("bike");
  const [originId, setOriginId] = useState<string>("me");

  // Where to measure from: my location, or one of my stations if location is off.
  const origin: { point: LatLon; label: string } | null = useMemo(() => {
    if (originId === "me") return geo.status === "ok" ? { point: geo.position, label: "you" } : null;
    const s = stations.get(originId);
    return s ? { point: s, label: s.name } : null;
  }, [originId, geo, stations]);

  const results = useMemo(() => {
    if (!origin) return [];
    return [...stations.values()]
      .map((s) => ({ s, st: statuses[s.station_id], d: distanceM(origin.point, s) }))
      .filter(({ s, st }) => {
        if (!st?.is_renting || s.station_id === originId) return false;
        if (need === "bike") return st.bikes_available > 0;
        if (need === "ebike") return st.ebikes_available > 0;
        return st.docks_available > 0;
      })
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);
  }, [origin, stations, statuses, need, originId]);

  return (
    <section className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
      <aside className="space-y-5">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">What do you need?</h2>
          <div className="mt-2 flex flex-col gap-1" role="radiogroup" aria-label="What do you need">
            {NEEDS.map((n) => (
              <button
                key={n.id}
                role="radio"
                aria-checked={need === n.id}
                onClick={() => setNeed(n.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  need === n.id ? "border-sky-500 bg-sky-50 font-medium" : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Near</h2>
          <div className="mt-2 flex flex-col gap-1">
            <button
              onClick={() => {
                setOriginId("me");
                if (geo.status !== "ok") onLocate();
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                originId === "me" ? "border-sky-500 bg-sky-50 font-medium" : "border-stone-200 bg-white hover:border-stone-400"
              }`}
            >
              ◎ My location
              {geo.status === "locating" && <span className="ml-2 text-xs text-stone-500">locating…</span>}
            </button>
            {follows.slice(0, 6).map((id) => (
              <button
                key={id}
                onClick={() => setOriginId(id)}
                className={`truncate rounded-lg border px-3 py-2 text-left text-sm ${
                  originId === id ? "border-sky-500 bg-sky-50 font-medium" : "border-stone-200 bg-white hover:border-stone-400"
                }`}
              >
                {stations.get(id)?.name}
              </button>
            ))}
          </div>
          {geo.status === "error" && originId === "me" && <p className="mt-2 text-xs text-amber-700">{geo.message}</p>}
        </div>
      </aside>

      <div>
        {!origin ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
            <p className="font-medium">Find the closest station that has what you need.</p>
            <p className="mt-1 text-sm text-stone-500">
              Share your location, or pick one of your stations on the left to search around it.
            </p>
            <button
              onClick={onLocate}
              className="mt-5 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              {geo.status === "locating" ? "Locating…" : "Use my location"}
            </button>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-stone-500">
              Closest stations to <span className="font-medium text-stone-800">{origin.label}</span> that{" "}
              {need === "dock" ? "have an open dock" : need === "ebike" ? "have an e-bike" : "have a bike"}, live:
            </p>
            {results.length === 0 ? (
              <p className="text-sm text-stone-500">No matching stations found.</p>
            ) : (
              <ol className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">
                {results.map(({ s, st, d }, i) => {
                  const av = availability(st) ?? "closed";
                  const mine = follows.includes(s.station_id);
                  return (
                    <li key={s.station_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <span className="hidden w-6 text-center text-sm font-semibold text-stone-400 sm:block">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 font-medium">
                          <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: AVAILABILITY_STYLE[av].color }} />
                          <span className="truncate">{s.name}</span>
                        </p>
                        <p className="mt-0.5 text-sm text-stone-500">
                          {formatDistance(d)} · ~{walkMinutes(d)} min walk ·{" "}
                          <span className="text-stone-800">
                            {st.bikes_available - st.ebikes_available} classic, {st.ebikes_available} e-bikes, {st.docks_available} docks
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => onShowOnMap(s.station_id)}
                          aria-label={`Show ${s.name} on map`}
                          className="rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-medium hover:border-stone-500"
                        >
                          Map
                        </button>
                        {!mine && (
                          <button
                            onClick={() => onFollow(s.station_id)}
                            className="rounded-md border border-stone-300 px-2.5 py-1.5 text-xs font-medium hover:border-sky-500"
                          >
                            + Follow
                          </button>
                        )}
                        <a
                          href={directionsUrl(s)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md bg-sky-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                        >
                          Directions ↗
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  );
}
