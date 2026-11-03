import { useMemo } from "react";
import type { StationStatus } from "@/lib/types";

/** Citywide totals from every station's latest status. */
export function CityStats({ statuses }: { statuses: Record<string, StationStatus> }) {
  const t = useMemo(() => {
    const all = Object.values(statuses);
    const renting = all.filter((s) => s.is_renting);
    return {
      stations: renting.length,
      bikes: renting.reduce((n, s) => n + s.bikes_available, 0),
      ebikes: renting.reduce((n, s) => n + s.ebikes_available, 0),
      empty: renting.filter((s) => s.bikes_available === 0).length,
      full: renting.filter((s) => s.docks_available === 0).length,
    };
  }, [statuses]);

  if (t.stations === 0) return null;
  const items = [
    { label: "stations open", value: t.stations, wide: true },
    { label: "bikes available", value: t.bikes },
    { label: "of them e-bikes", value: t.ebikes },
    { label: "stations empty", value: t.empty },
    { label: "stations full", value: t.full, wide: true },
  ];
  return (
    <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 shadow-sm sm:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className={`flex-col-reverse bg-white px-3 py-2.5 sm:px-4 sm:py-3 ${i.wide ? "hidden sm:flex" : "flex"}`}>
          <dt className="text-xs text-stone-500">{i.label}</dt>
          <dd className="text-lg font-semibold sm:text-xl tabular-nums transition-all">{i.value.toLocaleString("en-US")}</dd>
        </div>
      ))}
    </dl>
  );
}
