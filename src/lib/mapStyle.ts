import type { Availability } from "./types";

export type MapFilter = "all" | "bikes" | "ebikes" | "docks";

/** One color per availability, shared by the map dots, the legend and the cards. */
export const AVAILABILITY_STYLE: Record<Availability, { color: string; label: string }> = {
  ok: { color: "#10b981", label: "Bikes available" },
  low: { color: "#f59e0b", label: "1–2 bikes" },
  empty: { color: "#ef4444", label: "No bikes" },
  full: { color: "#6366f1", label: "No open docks" },
  closed: { color: "#a8a29e", label: "Not renting" },
};
