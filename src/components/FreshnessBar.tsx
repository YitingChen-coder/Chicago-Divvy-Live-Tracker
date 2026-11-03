import { formatAgo, RUN_INTERVAL_S, type Freshness, type WorkerRun } from "@/lib/freshness";

const STYLES = {
  loading: { box: "border-stone-200 bg-stone-50", dot: "bg-stone-300 animate-pulse", title: "Connecting…" },
  fresh: { box: "border-emerald-200 bg-emerald-50", dot: "bg-emerald-500 live-dot", title: "Live" },
  stale: { box: "border-amber-300 bg-amber-50", dot: "bg-amber-500", title: "Data may be out of date" },
  down: { box: "border-red-300 bg-red-50", dot: "bg-red-500", title: "Updates are down" },
} as const;

export function FreshnessBar({
  freshness,
  latestRun,
  socket,
  now,
}: {
  freshness: Freshness;
  latestRun: WorkerRun | null | undefined;
  socket: string;
  now: number;
}) {
  const s = STYLES[freshness.state];
  const nextIn =
    freshness.state === "fresh" ? Math.max(0, RUN_INTERVAL_S - (freshness.checkedAgoS % RUN_INTERVAL_S)) : null;

  let detail: string;
  switch (freshness.state) {
    case "loading":
      detail = "Loading the latest data from the worker.";
      break;
    case "fresh": {
      // Divvy refreshes about once a minute and we check every 30 s, so every other
      // check finds nothing new. Show the feed's own age instead of "0 changed".
      const sourceAgoS = latestRun?.source_updated_at
        ? Math.max(0, Math.round((now - Date.parse(latestRun.source_updated_at)) / 1000))
        : null;
      const changed = latestRun?.rows_changed ? ` · ${latestRun.rows_changed} stations changed citywide` : "";
      detail = `${sourceAgoS != null ? `Divvy data from ${formatAgo(sourceAgoS)}` : `Checked ${formatAgo(freshness.checkedAgoS)}`}${changed} · next check in ~${nextIn}s`;
      break;
    }
    case "stale":
      detail = `${freshness.reason} ${
        freshness.checkedAgoS != null ? `Last good check ${formatAgo(freshness.checkedAgoS)}.` : ""
      } Numbers below may not match the dock.`;
      break;
    case "down":
      detail = `The last update failed: ${freshness.error}. ${
        freshness.lastGoodAgoS != null ? `Showing data from ${formatAgo(freshness.lastGoodAgoS)}.` : ""
      } It retries every ${RUN_INTERVAL_S}s.`;
      break;
  }

  const disconnected = socket !== "SUBSCRIBED" && freshness.state !== "loading";

  return (
    <div
      className={`sticky top-0 z-10 mt-4 flex flex-col gap-1 rounded-xl border px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:gap-3 ${s.box}`}
    >
      {/* Only the state is announced to screen readers; the ticking detail would be noise. */}
      <div className="flex items-center gap-2" role="status" aria-live="polite">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.dot}`} aria-hidden />
        <span className="whitespace-nowrap font-semibold">{s.title}</span>
      </div>
      <span className="text-sm text-stone-700" suppressHydrationWarning>
        {detail}
      </span>
      {disconnected && (
        <span className="text-xs text-stone-500 sm:ml-auto" title={`Realtime: ${socket}`}>
          Reconnecting to live updates…
        </span>
      )}
    </div>
  );
}
