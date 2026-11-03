"use client";

import { useMemo, useState } from "react";
import type { Station } from "@/lib/types";

export function StationSearch({
  stations,
  follows,
  onFollow,
  disabled,
}: {
  stations: Map<string, Station> | null;
  follows: string[];
  onFollow: (id: string) => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!stations || term.length < 2) return [];
    const words = term.split(/\s+/);
    return [...stations.values()].filter((s) => words.every((w) => s.name.toLowerCase().includes(w))).slice(0, 8);
  }, [q, stations]);

  return (
    <div className="relative w-full sm:w-80">
      <label htmlFor="station-search" className="sr-only">Find a station</label>
      <input
        id="station-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        placeholder={disabled ? "Loading stations…" : "Find a station, e.g. 57th"}
        autoComplete="off"
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:bg-stone-50"
      />
      {q.trim().length >= 2 && (
        <ul className="absolute right-0 z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-stone-500">No stations match “{q}”.</li>}
          {results.map((s) => {
            const following = follows.includes(s.station_id);
            return (
              <li key={s.station_id}>
                <button
                  onClick={() => {
                    onFollow(s.station_id);
                    setQ("");
                  }}
                  disabled={following}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sky-50 disabled:cursor-default disabled:text-stone-400 disabled:hover:bg-transparent"
                >
                  <span>{s.name}</span>
                  <span className="shrink-0 text-xs font-medium text-sky-600">{following ? "Following" : "+ Follow"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
