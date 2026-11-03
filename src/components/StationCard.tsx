import { formatAgo } from "@/lib/freshness";
import type { LiveChange, Station, StationStatus } from "@/lib/types";

export function StationCard({
  station,
  status,
  change,
  dimmed,
  now,
  onUnfollow,
}: {
  station: Station | undefined;
  status: StationStatus | undefined;
  change: LiveChange | undefined;
  dimmed: boolean;
  now: number;
  onUnfollow: () => void;
}) {
  const name = station?.name ?? "Unknown station";
  const closed = status && !status.is_renting;
  const classic = status ? Math.max(0, status.bikes_available - status.ebikes_available) : 0;
  const total = status ? status.bikes_available + status.docks_available : 0;
  const bikePct = status && total > 0 ? (status.bikes_available / total) * 100 : 0;

  return (
    <article
      key={change?.key}
      className={`relative rounded-2xl border bg-white p-5 shadow-sm transition ${
        change ? "flash border-sky-400" : "border-stone-200"
      } ${dimmed ? "opacity-70" : ""}`}
    >
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug">{name}</h3>
        <button
          onClick={onUnfollow}
          aria-label={`Unfollow ${name}`}
          className="-mr-1 -mt-1 rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-stone-100 hover:text-stone-700"
        >
          Unfollow
        </button>
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

          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100"
            title={`${status.bikes_available} of ${total} docks hold a bike`}
          >
            <div className="h-full rounded-full bg-sky-500 transition-all duration-700" style={{ width: `${bikePct}%` }} />
          </div>
          <p className="sr-only">{`${status.bikes_available} of ${total} docks hold a bike`}</p>

          <footer className="mt-3 flex items-center justify-between text-xs text-stone-500">
            <span suppressHydrationWarning>Changed {formatAgo(Math.round((now - Date.parse(status.changed_at)) / 1000))}</span>
            {change && <DeltaChip change={change} />}
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
