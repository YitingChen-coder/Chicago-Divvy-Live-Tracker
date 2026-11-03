import { formatAgo } from "@/lib/freshness";
import { directionsUrl, distanceLabel, walkMinutes } from "@/lib/geo";
import type { HistoryPoint, LiveChange, Station, StationStatus } from "@/lib/types";
import { DockGrid } from "./DockGrid";
import { Trend } from "./Trend";

export function StationCard({
  station,
  status,
  change,
  dimmed,
  now,
  distanceM,
  history,
  alertOn,
  alternative,
  onToggleAlert,
  onUnfollow,
  onShowOnMap,
}: {
  station: Station | undefined;
  status: StationStatus | undefined;
  change: LiveChange | undefined;
  dimmed: boolean;
  now: number;
  distanceM: number | null;
  history: HistoryPoint[] | undefined;
  alertOn: boolean;
  alternative: { station: Station; status: StationStatus; meters: number } | null;
  onToggleAlert: () => void;
  onUnfollow: () => void;
  onShowOnMap: () => void;
}) {
  const name = station?.name ?? "Unknown station";
  const closed = status && !status.is_renting;
  const classic = status ? Math.max(0, status.bikes_available - status.ebikes_available) : 0;
  const total = status ? status.bikes_available + status.docks_available : 0;

  return (
    <article
      key={change?.key}
      className={`relative rounded-2xl border bg-white p-5 shadow-sm transition ${
        change ? "flash border-sky-400" : "border-stone-200"
      } ${dimmed ? "opacity-70" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{name}</h3>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          <button
            onClick={onToggleAlert}
            aria-pressed={alertOn}
            aria-label={alertOn ? `Stop alerts for ${name}` : `Alert me when ${name} runs out or gets bikes back`}
            title={alertOn ? "Alerts on" : "Alert me when this station runs out or gets bikes back"}
            className={`rounded-md px-1.5 py-1 text-sm transition ${alertOn ? "" : "opacity-30 grayscale hover:opacity-70"}`}
          >
            🔔
          </button>
          <button
            onClick={onUnfollow}
            aria-label={`Unfollow ${name}`}
            className="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            Unfollow
          </button>
        </div>
      </header>

      {!status ? (
        <p className="mt-6 text-sm text-stone-500">Waiting for the first update from this station…</p>
      ) : (
        <>
          <Alert closed={!!closed} bikes={status.bikes_available} docks={status.docks_available} />
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="Classic bikes" value={classic} />
            <Stat label="E-bikes" value={status.ebikes_available} accent />
            <Stat label="Open docks" value={status.docks_available} />
          </dl>

          <DockGrid status={status} capacity={station?.capacity ?? null} />
          <Trend points={history} now={now} capacity={station?.capacity ?? null} />
          {alternative && status.bikes_available <= 2 && (
            <a
              href={directionsUrl(alternative.station)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 hover:bg-emerald-100"
            >
              <span>
                <b>{alternative.status.bikes_available} bikes</b> at {alternative.station.name}
              </span>
              <span className="shrink-0">~{walkMinutes(alternative.meters)} min walk ↗</span>
            </a>
          )}
          <p className="sr-only">{`${status.bikes_available} of ${total} docks hold a bike`}</p>

          <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
            <span suppressHydrationWarning>Changed {formatAgo(Math.round((now - Date.parse(status.changed_at)) / 1000))}</span>
            {change && <DeltaChip change={change} />}
          </div>

          <footer className="mt-4 flex items-center gap-2 border-t border-stone-100 pt-3">
            {distanceM != null && (
              <span className="mr-auto text-xs text-stone-500">
                {distanceLabel(distanceM)}
              </span>
            )}
            <button
              onClick={onShowOnMap}
              aria-label={`Show ${name} on map`}
              className={`${distanceM == null ? "ml-auto " : ""}rounded-md border border-stone-300 px-2.5 py-1 text-xs font-medium hover:border-stone-500`}
            >
              Map
            </button>
            {station && (
              <a
                href={directionsUrl(station)}
                target="_blank"
                rel="noreferrer"
                className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700"
              >
                Directions ↗
              </a>
            )}
          </footer>
        </>
      )}
    </article>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className={`text-3xl font-semibold tabular-nums ${value === 0 ? "text-stone-300" : accent ? "text-sky-600" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

/** The one thing a rider needs to know before walking over. */
function Alert({ closed, bikes, docks }: { closed: boolean; bikes: number; docks: number }) {
  const [text, cls] = closed
    ? ["Not renting right now", "bg-stone-800 text-white"]
    : bikes === 0
      ? ["No bikes right now", "bg-amber-100 text-amber-900"]
      : docks === 0
        ? ["Full: no open docks to return", "bg-amber-100 text-amber-900"]
        : bikes <= 2
          ? ["Only a few bikes left", "bg-stone-100 text-stone-700"]
          : [null, ""];
  if (!text) return null;
  return <p className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{text}</p>;
}

function DeltaChip({ change }: { change: LiveChange }) {
  const text = change.closed
    ? "Closed"
    : change.reopened
      ? "Reopened"
      : change.bikesDelta !== 0
        ? `${change.bikesDelta > 0 ? "+" : ""}${change.bikesDelta} bike${Math.abs(change.bikesDelta) === 1 ? "" : "s"}`
        : "Updated";
  const good = change.bikesDelta > 0 || change.reopened;
  return (
    <span className={`rounded-full px-2 py-0.5 font-medium ${good ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>
      {text}
    </span>
  );
}

export function StationCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-stone-200 bg-white p-5" aria-hidden>
      <div className="h-4 w-2/3 rounded bg-stone-200" />
      <div className="mt-6 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="mx-auto h-8 w-10 rounded bg-stone-200" />
        ))}
      </div>
      <div className="mt-5 h-2 rounded-full bg-stone-100" />
    </div>
  );
}
