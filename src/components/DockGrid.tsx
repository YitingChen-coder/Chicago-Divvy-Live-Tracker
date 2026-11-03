import type { StationStatus } from "@/lib/types";

/** One square per dock: classic bike, e-bike, open, or out of service. */
export function DockGrid({ status, capacity }: { status: StationStatus; capacity: number | null }) {
  const classic = Math.max(0, status.bikes_available - status.ebikes_available);
  const ebikes = status.ebikes_available;
  const open = status.docks_available;
  const total = Math.max(capacity ?? 0, classic + ebikes + open);
  const broken = Math.max(0, total - classic - ebikes - open);
  const cells = [
    ...Array<string>(classic).fill("bg-sky-700"),
    ...Array<string>(ebikes).fill("bg-sky-400"),
    ...Array<string>(open).fill("bg-white ring-1 ring-inset ring-stone-300"),
    ...Array<string>(broken).fill("bg-stone-300 dock-broken"),
  ];
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-[3px]" role="img"
        aria-label={`${total} docks: ${classic} classic bikes, ${ebikes} e-bikes, ${open} open${broken ? `, ${broken} out of service` : ""}`}>
        {cells.map((c, i) => (
          <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
        ))}
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-stone-500">
        <span><i className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-sky-700 align-middle" />classic</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-sky-400 align-middle" />e-bike</span>
        <span><i className="mr-1 inline-block h-2 w-2 rounded-[2px] bg-white align-middle ring-1 ring-inset ring-stone-300" />open dock</span>
        {broken > 0 && <span><i className="dock-broken mr-1 inline-block h-2 w-2 rounded-[2px] bg-stone-300 align-middle" />out of service</span>}
        <span className="ml-auto">{total} docks</span>
      </p>
    </div>
  );
}
