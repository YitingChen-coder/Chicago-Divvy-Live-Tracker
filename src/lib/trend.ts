import type { HistoryPoint } from "./types";

export type Step = { x0: number; x1: number; bikes: number; ebikes: number };

/**
 * Turns change points into flat steps across a time window: each value holds
 * until the next change, and the last one holds until `to`. Points before the
 * window only set the starting value.
 */
export function toSteps(points: HistoryPoint[], from: number, to: number): Step[] {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const before = sorted.filter((p) => p.t <= from).at(-1);
  const inside = sorted.filter((p) => p.t > from && p.t <= to);
  const starts = before ? [{ ...before, t: from }, ...inside] : inside;
  return starts.map((p, i) => ({
    x0: p.t,
    x1: i + 1 < starts.length ? starts[i + 1].t : to,
    bikes: p.bikes,
    ebikes: p.ebikes,
  }));
}

/** Smallest and largest bike count in the window, and how long it was empty. */
export function summarize(steps: Step[]) {
  if (steps.length === 0) return null;
  const bikes = steps.map((s) => s.bikes);
  const emptyMs = steps.filter((s) => s.bikes === 0).reduce((n, s) => n + (s.x1 - s.x0), 0);
  return { min: Math.min(...bikes), max: Math.max(...bikes), emptyMs, changes: steps.length - 1 };
}
