// Checks how history points become the step chart on each card.
import assert from "node:assert/strict";
import { test } from "node:test";
import { summarize, toSteps } from "./trend.ts";

const H = 3_600_000;
const p = (t: number, bikes: number, ebikes = 0) => ({ t, bikes, ebikes, docks: 10 - bikes });

test("each value holds until the next change, the last one until now", () => {
  const steps = toSteps([p(1 * H, 3), p(2 * H, 5)], 0, 4 * H);
  assert.deepEqual(steps.map((s) => [s.x0, s.x1, s.bikes]), [[1 * H, 2 * H, 3], [2 * H, 4 * H, 5]]);
});

test("a point before the window becomes the starting value", () => {
  const steps = toSteps([p(-5 * H, 7), p(2 * H, 1)], 0, 4 * H);
  assert.deepEqual(steps.map((s) => [s.x0, s.bikes]), [[0, 7], [2 * H, 1]]);
});

test("points come back sorted even if they arrive out of order", () => {
  const steps = toSteps([p(3 * H, 2), p(1 * H, 4)], 0, 4 * H);
  assert.deepEqual(steps.map((s) => s.bikes), [4, 2]);
});

test("no history gives no steps", () => {
  assert.deepEqual(toSteps([], 0, H), []);
  assert.equal(summarize([]), null);
});

test("summary: min, max, and time spent empty", () => {
  const s = summarize(toSteps([p(0, 4), p(1 * H, 0), p(3 * H, 6)], 0, 4 * H))!;
  assert.deepEqual(s, { min: 0, max: 6, emptyMs: 2 * H, changes: 2 });
});
