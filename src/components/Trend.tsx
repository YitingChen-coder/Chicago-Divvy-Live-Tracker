"use client";

import { useState } from "react";
import { flow, stepAt, summarize, toSteps } from "@/lib/trend";
import type { HistoryPoint } from "@/lib/types";

const W = 280;
const H = 56;
const DAY_MS = 24 * 60 * 60 * 1000;

const bikes = (n: number) => `${n} bike${n === 1 ? "" : "s"}`;
const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/**
 * Bikes at this station over the last 24 hours (or since tracking began), as a
 * step chart. Hover or drag to read the value at any moment.
 */
export function Trend({ points, now, capacity }: { points: HistoryPoint[] | undefined; now: number; capacity: number | null }) {
  const [hoverT, setHoverT] = useState<number | null>(null);
  const first = points?.length ? Math.min(...points.map((p) => p.t)) : now;
  const from = Math.max(now - DAY_MS, Math.min(first, now - 60_000));
  const steps = toSteps(points ?? [], from, now);
  const sum = summarize(steps);
  if (!sum) return <div className="mt-4 h-[78px] rounded-lg bg-stone-50" aria-hidden />;

  const top = Math.max(sum.max, capacity ? Math.min(capacity, sum.max + 2) : sum.max, 1);
  const x = (t: number) => ((t - from) / (now - from)) * W;
  const y = (v: number) => H - (v / top) * (H - 6) - 3;
  const path = (key: "bikes" | "ebikes") =>
    steps.map((s, i) => `${i === 0 ? "M" : "L"}${x(s.x0).toFixed(1)},${y(s[key]).toFixed(1)} H${x(s.x1).toFixed(1)}`).join(" ");
  const close = ` V${H} H${x(steps[0].x0).toFixed(1)} Z`;
  const tracked = now - from < DAY_MS - 60_000;
  const emptyMin = Math.round(sum.emptyMs / 60_000);
  const { taken, returned } = flow((points ?? []).filter((p) => p.t >= from));
  const hover = hoverT != null ? stepAt(steps, hoverT) : undefined;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setHoverT(from + frac * (now - from));
  };

  return (
    <figure className="mt-4">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium text-stone-600">Bikes {tracked ? `since ${clock(from)}` : "· last 24 h"}</span>
        <span className="tabular-nums text-stone-500" suppressHydrationWarning>
          {hover ? (
            <>
              <b className="text-stone-800">{clock(hoverT!)}</b> · {bikes(hover.bikes)} ({hover.ebikes} e)
            </>
          ) : (
            <>
              {sum.min === sum.max ? bikes(sum.max) : `${sum.min}–${sum.max} bikes`}
            </>
          )}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-14 w-full cursor-crosshair touch-none"
        role="img"
        aria-label={`Bikes ${tracked ? "since " + clock(from) : "over the last 24 hours"}: between ${sum.min} and ${sum.max}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHoverT(null)}
      >
        {[0.5, 1].map((f) => (
          <line key={f} x1="0" x2={W} y1={y(top * f)} y2={y(top * f)} stroke="rgb(231 229 228)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={path("bikes") + close} fill="rgb(14 165 233 / 0.12)" />
        <path d={path("ebikes") + close} fill="rgb(14 165 233 / 0.25)" />
        <path d={path("bikes")} fill="none" stroke="rgb(2 132 199)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {steps.filter((s) => s.bikes === 0).map((s) => (
          <rect key={s.x0} x={x(s.x0)} y={H - 3} width={Math.max(1, x(s.x1) - x(s.x0))} height={3} fill="rgb(239 68 68)" />
        ))}
        {hoverT != null && <line x1={x(hoverT)} x2={x(hoverT)} y1="0" y2={H} stroke="rgb(68 64 60)" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-x-3 text-[11px] text-stone-500" suppressHydrationWarning>
        <span>
          <span className="text-stone-700">↓ {taken}</span> taken · <span className="text-stone-700">↑ {returned}</span> returned
        </span>
        {emptyMin > 0 ? <span className="text-red-500">empty {emptyMin} min</span> : <span>{sum.changes} change{sum.changes === 1 ? "" : "s"}</span>}
      </figcaption>
    </figure>
  );
}
