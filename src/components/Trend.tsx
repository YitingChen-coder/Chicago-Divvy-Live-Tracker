import { summarize, toSteps } from "@/lib/trend";
import type { HistoryPoint } from "@/lib/types";

const W = 280;
const H = 44;
const DAY_MS = 24 * 60 * 60 * 1000;

const clock = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

/** Bikes at this station over the last 24 hours (or since tracking began), as a step chart. */
export function Trend({ points, now, capacity }: { points: HistoryPoint[] | undefined; now: number; capacity: number | null }) {
  const first = points?.length ? Math.min(...points.map((p) => p.t)) : now;
  const from = Math.max(now - DAY_MS, Math.min(first, now - 60_000));
  const steps = toSteps(points ?? [], from, now);
  const sum = summarize(steps);
  if (!sum) return <div className="mt-4 h-[60px] rounded-lg bg-stone-50" aria-hidden />;

  const top = Math.max(sum.max, capacity ? Math.min(capacity, sum.max + 2) : sum.max, 1);
  const x = (t: number) => ((t - from) / (now - from)) * W;
  const y = (v: number) => H - (v / top) * (H - 4) - 2;
  const line = steps.map((s, i) => `${i === 0 ? "M" : "L"}${x(s.x0).toFixed(1)},${y(s.bikes).toFixed(1)} H${x(s.x1).toFixed(1)}`).join(" ");
  const area = `${line} V${H} H${x(steps[0].x0).toFixed(1)} Z`;
  const ebikeArea =
    steps.map((s, i) => `${i === 0 ? "M" : "L"}${x(s.x0).toFixed(1)},${y(s.ebikes).toFixed(1)} H${x(s.x1).toFixed(1)}`).join(" ") +
    ` V${H} H${x(steps[0].x0).toFixed(1)} Z`;
  const tracked = now - from < DAY_MS - 60_000;
  const emptyMin = Math.round(sum.emptyMs / 60_000);

  return (
    <figure className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-11 w-full" role="img"
        aria-label={`Bikes ${tracked ? "since " + clock(from) : "over the last 24 hours"}: between ${sum.min} and ${sum.max}`}>
        <path d={area} fill="rgb(14 165 233 / 0.12)" />
        <path d={ebikeArea} fill="rgb(14 165 233 / 0.22)" />
        <path d={line} fill="none" stroke="rgb(2 132 199)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {steps.filter((s) => s.bikes === 0).map((s) => (
          <rect key={s.x0} x={x(s.x0)} y={H - 3} width={Math.max(1, x(s.x1) - x(s.x0))} height={3} fill="rgb(239 68 68)" />
        ))}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[11px] text-stone-400" suppressHydrationWarning>
        <span>{tracked ? `Since ${clock(from)}` : "24 h ago"}</span>
        <span>
          {sum.min === sum.max ? `${sum.max} bikes` : `${sum.min}–${sum.max} bikes`}
          {emptyMin > 0 && <span className="text-red-500"> · empty {emptyMin} min</span>}
        </span>
        <span>now</span>
      </figcaption>
    </figure>
  );
}
