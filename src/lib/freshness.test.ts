// Checks how the page decides loading / fresh / stale / down.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { getFreshness, type WorkerRun } from "./freshness.ts";

const NOW = Date.parse("2026-11-03T02:00:00Z");
const run = (secondsAgo: number, ok = true, sourceSecondsAgo = secondsAgo): WorkerRun => ({
  id: 1,
  finished_at: new Date(NOW - secondsAgo * 1000).toISOString(),
  ok,
  rows_changed: 12,
  stations_seen: 2079,
  source_updated_at: new Date(NOW - sourceSecondsAgo * 1000).toISOString(),
  error: ok ? null : "GET station_status.json -> HTTP 503",
});

test("loading until the first query returns", () => {
  assert.equal(getFreshness(undefined, undefined, NOW).state, "loading");
});

test("fresh when the last run succeeded 20 s ago", () => {
  const r = run(20);
  assert.deepEqual(getFreshness(r, r, NOW), { state: "fresh", checkedAgoS: 20 });
});

test("stale after about three missed runs", () => {
  const r = run(120);
  assert.equal(getFreshness(r, r, NOW).state, "stale");
});

test("stale when the worker runs fine but Divvy's own feed stopped updating", () => {
  const r = run(10, true, 600);
  assert.equal(getFreshness(r, r, NOW).state, "stale");
});

test("down when the latest run failed, even if an older run was fine", () => {
  const f = getFreshness(run(5, false), run(35), NOW);
  assert.equal(f.state, "down");
  assert.equal(f.state === "down" && f.lastGoodAgoS, 35);
});

test("stale (not down) when there are no runs at all yet", () => {
  assert.equal(getFreshness(null, null, NOW).state, "stale");
});
