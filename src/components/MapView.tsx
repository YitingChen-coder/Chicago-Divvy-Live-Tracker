"use client";

import dynamic from "next/dynamic";
import type { LatLon } from "@/lib/geo";
import type { Station, StationStatus } from "@/lib/types";
import { AVAILABILITY_STYLE, type MapFilter } from "@/lib/mapStyle";

// Leaflet needs the browser, so skip server rendering for the map itself.
const StationMap = dynamic(() => import("./StationMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-stone-500">Loading map…</div>,
});

const FILTERS: { id: MapFilter; label: string }[] = [
  { id: "all", label: "All stations" },
  { id: "bikes", label: "Has bikes" },
  { id: "ebikes", label: "Has e-bikes" },
  { id: "docks", label: "Has open docks" },
];

export function MapView(props: {
  stations: Map<string, Station>;
  statuses: Record<string, StationStatus>;
  follows: string[];
  filter: MapFilter;
  setFilter: (f: MapFilter) => void;
  focus: string | null;
  userPos: LatLon | null;
  onLocate: () => void;
  locating: boolean;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
}) {
  const { filter, setFilter, onLocate, locating } = props;
  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Filter stations" className="flex flex-wrap gap-1 rounded-lg bg-stone-200/60 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === f.id ? "bg-white font-medium shadow-sm" : "text-stone-600 hover:text-stone-900"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={onLocate}
          className="ml-auto rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:border-sky-500"
        >
          {locating ? "Locating…" : "◎ Near me"}
        </button>
      </div>

      <div className="relative h-[68vh] min-h-96 overflow-hidden rounded-2xl border border-stone-200 shadow-sm">
        <StationMap {...props} />
        <ul className="pointer-events-none absolute bottom-3 left-3 z-[400] space-y-1 rounded-lg bg-white/90 px-3 py-2 text-xs shadow">
          {Object.entries(AVAILABILITY_STYLE).map(([k, v]) => (
            <li key={k} className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: v.color }} />
              {v.label}
            </li>
          ))}
          <li className="flex items-center gap-2 pt-1">
            <span className="inline-block h-3 w-3 rounded-full border-[3px] border-sky-900" />
            Stations you follow
          </li>
        </ul>
      </div>
      <p className="mt-2 text-xs text-stone-500">
        Tap a dot for bikes, docks and walking directions. Colors refresh after every worker run; your followed stations
        update the instant they change.
      </p>
    </section>
  );
}
