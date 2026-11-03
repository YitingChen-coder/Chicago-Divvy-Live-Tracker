// Checks which station changes are worth an alert.
import assert from "node:assert/strict";
import { test } from "node:test";
import { alertFor } from "./alerts.ts";

const status = (bikes: number, docks: number, ebikes = 0, renting = true) => ({
  station_id: "s", bikes_available: bikes, ebikes_available: ebikes, docks_available: docks,
  is_renting: renting, last_reported: null, changed_at: "2026-11-03T03:00:00Z",
});
const change = (bikesDelta: number, docksDelta: number, extra = {}) => ({ key: "k", station_id: "s", at: 0, bikesDelta, docksDelta, ...extra });

test("ran out of bikes", () => assert.match(alertFor(change(-1, 1), status(0, 10), "X")!.title, /ran out/));
test("bikes are back", () => assert.match(alertFor(change(2, -2), status(2, 8), "X")!.title, /Bikes are back/));
test("station filled up", () => assert.match(alertFor(change(1, -1), status(10, 0), "X")!.title, /full/));
test("closed and reopened", () => {
  assert.match(alertFor(change(0, 0, { closed: true }), status(3, 3, 0, false), "X")!.title, /stopped renting/);
  assert.match(alertFor(change(0, 0, { reopened: true }), status(3, 3), "X")!.title, /renting again/);
});
test("an ordinary change (5 -> 4 bikes) is not an alert", () => assert.equal(alertFor(change(-1, 1), status(4, 6), "X"), null));
