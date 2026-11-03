// Runs the worker's logic on saved copies of the real Divvy feed (fixtures/),
// taken 3 minutes apart on 2026-11-02, and checks what it would save.
// Run: deno test supabase/functions/divvy-sync/  (or: npm run test:worker)

import { assertEquals, assertThrows } from "@std/assert";
import { changedStationRows, changedStatusRows, parseInfoFeed, parseStatusFeed, type StatusRow } from "./sync.ts";

const load = async (name: string) =>
  JSON.parse(await Deno.readTextFile(new URL(`./fixtures/${name}`, import.meta.url)));

const before = parseStatusFeed(await load("status_before.json"));
const after = parseStatusFeed(await load("status_after.json"));
const byId = (rows: StatusRow[]) => new Map(rows.map((r) => [r.station_id, r]));

// Station ids in the fixture, grouped by what happened between the two snapshots.
const COUNTS_CHANGED = ["2129148164045400658", "2134710117969748266", "a3a565b1-a135-11e9-9cda-0a87ae2ba916"];
const CHECKIN_ONLY = ["a3a72012-a135-11e9-9cda-0a87ae2ba916", "1955905507044284968"]; // newer last_reported, same counts

Deno.test("parses the feed into rows and skips a malformed station", () => {
  assertEquals(after.rows.length, 6); // 7 in the file, "broken-1" has no bike count
  assertEquals(after.rows.some((r) => r.station_id === "broken-1"), false);
  assertEquals(after.sourceUpdatedAt, "2026-11-03T02:32:41.000Z");
  const r = after.rows[0];
  assertEquals(typeof r.bikes_available, "number");
  assertEquals(typeof r.is_renting, "boolean");
});

Deno.test("first run (empty database): every station is saved", () => {
  assertEquals(changedStatusRows(before.rows, new Map()).length, 6);
});

Deno.test("same feed twice: nothing is saved", () => {
  assertEquals(changedStatusRows(before.rows, byId(before.rows)), []);
});

Deno.test("3 minutes later: only stations whose counts changed are saved", () => {
  const changed = changedStatusRows(after.rows, byId(before.rows)).map((r) => r.station_id);
  assertEquals(changed.sort(), [...COUNTS_CHANGED].sort());
  for (const id of CHECKIN_ONLY) assertEquals(changed.includes(id), false, `${id} only checked in`);
});

Deno.test("saved rows carry the new values", () => {
  const changed = changedStatusRows(after.rows, byId(before.rows));
  const fromFeed = byId(after.rows);
  for (const row of changed) assertEquals(row, fromFeed.get(row.station_id));
});

Deno.test("a station that stops renting counts as a change", () => {
  const old = byId(before.rows);
  const closed = before.rows.map((r) => (r.station_id === CHECKIN_ONLY[0] ? { ...r, is_renting: !r.is_renting } : r));
  assertEquals(changedStatusRows(closed, old).map((r) => r.station_id), [CHECKIN_ONLY[0]]);
});

Deno.test("a feed with the wrong shape throws, so the run is recorded as failed", () => {
  assertThrows(() => parseStatusFeed({ data: {} }));
  assertThrows(() => parseStatusFeed({ last_updated: 1, data: { stations: [] } }));
  assertThrows(() => parseStatusFeed("<html>Service unavailable</html>"));
});

Deno.test("station info: only new or renamed stations are saved", async () => {
  const info = parseInfoFeed(await load("station_information.json"));
  assertEquals(info.length, 6);
  const current = new Map(info.map((s) => [s.station_id, s]));
  assertEquals(changedStationRows(info, current), []);
  const renamed = info.map((s, i) => (i === 0 ? { ...s, name: "Renamed" } : s));
  assertEquals(changedStationRows(renamed, current).map((s) => s.name), ["Renamed"]);
});
