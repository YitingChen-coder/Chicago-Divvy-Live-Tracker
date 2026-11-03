import { formatAgo, RUN_INTERVAL_S, type WorkerRun } from "@/lib/freshness";

const ago = (iso: string | null | undefined, now: number) =>
  iso ? formatAgo(Math.max(0, Math.round((now - Date.parse(iso)) / 1000))) : "—";
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" });

/** How the data gets to this page, with live timings, and the worker's recent runs. */
export function SystemView({
  runs,
  now,
  socket,
  lastPushAt,
}: {
  runs: WorkerRun[] | null;
  now: number;
  socket: string;
  lastPushAt: number | null;
}) {
  if (!runs) return <p className="mt-6 text-sm text-stone-500">Loading worker runs…</p>;
  const latest = runs[0];
  const ok = runs.filter((r) => r.ok);
  const successRate = runs.length ? Math.round((ok.length / runs.length) * 100) : 0;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avgMs = avg(ok.map((r) => r.duration_ms ?? 0).filter(Boolean));
  const avgChanged = avg(ok.map((r) => r.rows_changed ?? 0));
  const maxChanged = Math.max(1, ...runs.map((r) => r.rows_changed ?? 0));
  const lastError = runs.find((r) => !r.ok);
  const chronological = [...runs].reverse();

  const pipeline = [
    { name: "Divvy feed", detail: `updated ${ago(latest?.source_updated_at, now)}`, note: "refreshes ~every 60 s" },
    { name: "Supabase Cron", detail: `every ${RUN_INTERVAL_S} s`, note: "calls the worker" },
    { name: "Edge Function", detail: `ran ${ago(latest?.finished_at, now)}`, note: latest ? `${latest.rows_changed ?? 0} rows changed` : "" },
    { name: "Postgres", detail: "station_status", note: "only changed rows" },
    { name: "Realtime", detail: socket === "SUBSCRIBED" ? "connected" : socket.toLowerCase(), note: lastPushAt ? `last push ${formatAgo(Math.round((now - lastPushAt) / 1000))}` : "waiting for a push" },
    { name: "This page", detail: "updated in place", note: "no refresh" },
  ];

  return (
    <section className="mt-6 space-y-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">How the data gets here</h2>
        <ol className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {pipeline.map((p, i) => (
            <li key={p.name} className="relative rounded-xl border border-stone-200 bg-white p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">Step {i + 1}</p>
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-sky-700" suppressHydrationWarning>{p.detail}</p>
              <p className="text-xs text-stone-500" suppressHydrationWarning>{p.note}</p>
              {i < pipeline.length - 1 && (
                <span aria-hidden className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-stone-300 lg:block">▶</span>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">Worker runs</h2>
          <p className="text-sm text-stone-500">Last {runs.length} runs (about {Math.round((runs.length * RUN_INTERVAL_S) / 60)} minutes)</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-4">
          {[
            { label: "succeeded", value: `${successRate}%` },
            { label: "avg run time", value: `${avgMs} ms` },
            { label: "avg stations changed per run", value: String(avgChanged) },
            { label: "last failure", value: lastError ? ago(lastError.finished_at, now) : "none" },
          ].map((k) => (
            <div key={k.label} className="flex flex-col-reverse bg-white px-4 py-3">
              <dt className="text-xs text-stone-500">{k.label}</dt>
              <dd className="text-xl font-semibold tabular-nums" suppressHydrationWarning>{k.value}</dd>
            </div>
          ))}
        </dl>

        <figure className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
          <figcaption className="mb-2 text-xs text-stone-500">
            Stations changed per run, oldest → newest. Divvy publishes about once a minute and the worker checks every{" "}
            {RUN_INTERVAL_S} s, so every other bar is near zero.
          </figcaption>
          <div className="flex h-28 items-end gap-[2px]" role="img" aria-label="Stations changed per worker run">
            {chronological.map((r) => (
              <div
                key={r.id}
                title={`${clock(r.finished_at)} · ${r.ok ? `${r.rows_changed ?? 0} changed` : `failed: ${r.error}`}`}
                className={`flex-1 rounded-t-sm ${r.ok ? "bg-sky-500" : "bg-red-500"}`}
                style={{ height: r.ok ? `${Math.max(2, ((r.rows_changed ?? 0) / maxChanged) * 100)}%` : "100%" }}
              />
            ))}
          </div>
        </figure>

        <div className="mt-4 overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Finished</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 text-right font-medium">Changed</th>
                <th className="px-4 py-2 text-right font-medium">Run time</th>
                <th className="px-4 py-2 font-medium">Divvy data from</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {runs.slice(0, 12).map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums" suppressHydrationWarning>{clock(r.finished_at)}</td>
                  <td className="px-4 py-2">
                    {r.ok ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">ok</span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700" title={r.error ?? ""}>failed</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.rows_changed ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{r.duration_ms != null ? `${r.duration_ms} ms` : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 tabular-nums text-stone-500" suppressHydrationWarning>
                    {r.source_updated_at ? clock(r.source_updated_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
