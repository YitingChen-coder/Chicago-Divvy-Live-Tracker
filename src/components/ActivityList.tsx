import { formatAgo } from "@/lib/freshness";
import type { LiveChange, Station } from "@/lib/types";

const describe = (c: LiveChange) => {
  if (c.closed) return "stopped renting";
  if (c.reopened) return "started renting again";
  const parts = [];
  if (c.bikesDelta) parts.push(`${c.bikesDelta > 0 ? "+" : ""}${c.bikesDelta} bike${Math.abs(c.bikesDelta) === 1 ? "" : "s"}`);
  if (c.docksDelta) parts.push(`${c.docksDelta > 0 ? "+" : ""}${c.docksDelta} dock${Math.abs(c.docksDelta) === 1 ? "" : "s"}`);
  return parts.join(", ") || "bike type mix changed";
};

/** Changes pushed to this page since it opened. */
export function ActivityList({ changes, stations, now }: { changes: LiveChange[]; stations: Map<string, Station>; now: number }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Live activity</h2>
      {changes.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">
          Nothing has changed at your stations since you opened this page. Changes show up here as they happen, with no refresh.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
          {changes.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span>
                <span className="font-medium">{stations.get(c.station_id)?.name ?? "A station"}</span>{" "}
                <span className="text-stone-600">{describe(c)}</span>
              </span>
              <span className="shrink-0 text-xs text-stone-400" suppressHydrationWarning>
                {formatAgo(Math.round((now - c.at) / 1000))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
