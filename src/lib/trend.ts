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

/**
 * Bikes taken and returned between consecutive points. A drop in bikes counts
 * as bikes taken, a rise as bikes returned. Several riders within one
 * 30-second check net out, so these are lower bounds.
 */
export function flow(points: HistoryPoint[]): { taken: number; returned: number } {
  const sorted = [...points].sort((a, b) => a.t - b.t);
  let taken = 0;
  let returned = 0;
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i].bikes - sorted[i - 1].bikes;
    if (d < 0) taken -= d;
    else returned += d;
  }
  return { taken, returned };
}

/** The value showing at time t, for the hover readout. */
export function stepAt(steps: Step[], t: number): Step | undefined {
  return steps.find((s) => t >= s.x0 && t <= s.x1) ?? steps.at(-1);
}
