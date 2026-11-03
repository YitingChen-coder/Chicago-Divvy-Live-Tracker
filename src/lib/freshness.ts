// How fresh is the data on screen? Decided from the worker's run history.

export const RUN_INTERVAL_S = 30; // Supabase Cron calls the worker every 30 s
export const STALE_AFTER_S = RUN_INTERVAL_S * 3 + 15; // ~3 missed runs
export const SOURCE_STALE_AFTER_S = 5 * 60; // Divvy itself stopped updating

export type WorkerRun = {
  id: number;
  finished_at: string;
  ok: boolean;
  rows_changed: number | null;
  stations_seen: number | null;
  source_updated_at: string | null;
  error: string | null;
};

export type Freshness =
  | { state: "loading" }
  | { state: "fresh"; checkedAgoS: number }
  | { state: "stale"; checkedAgoS: number | null; reason: string }
  | { state: "down"; error: string; lastGoodAgoS: number | null };

const agoS = (iso: string | null | undefined, now: number) =>
  iso ? Math.max(0, Math.round((now - Date.parse(iso)) / 1000)) : null;

/**
 * - down:  the worker's most recent run failed
 * - stale: no successful run for ~3 intervals, or Divvy's own feed stopped updating
 * - fresh: otherwise
 */
export function getFreshness(
  latestRun: WorkerRun | null | undefined,
  latestOkRun: WorkerRun | null | undefined,
  now: number,
): Freshness {
  if (latestRun === undefined) return { state: "loading" };
  const lastGoodAgoS = agoS(latestOkRun?.finished_at, now);

  if (latestRun && !latestRun.ok) {
    return { state: "down", error: latestRun.error ?? "Unknown error", lastGoodAgoS };
  }
  if (lastGoodAgoS === null) {
    return { state: "stale", checkedAgoS: null, reason: "The worker hasn't finished a run yet." };
  }
  if (lastGoodAgoS > STALE_AFTER_S) {
    return { state: "stale", checkedAgoS: lastGoodAgoS, reason: "The worker has missed its last few runs." };
  }
  const sourceAgoS = agoS(latestOkRun?.source_updated_at, now);
  if (sourceAgoS !== null && sourceAgoS > SOURCE_STALE_AFTER_S) {
    return { state: "stale", checkedAgoS: lastGoodAgoS, reason: `Divvy's own feed last updated ${formatAgo(sourceAgoS)}.` };
  }
  return { state: "fresh", checkedAgoS: lastGoodAgoS };
}

export function formatAgo(seconds: number): string {
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}
