export type Station = {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number | null;
};

export type StationStatus = {
  station_id: string;
  bikes_available: number;
  ebikes_available: number;
  docks_available: number;
  is_renting: boolean;
  last_reported: string | null;
  changed_at: string;
};

/** One point of a station's history: its counts from this moment until the next point. */
export type HistoryPoint = { t: number; bikes: number; ebikes: number; docks: number };

/** A change pushed by Realtime, kept for the activity list and the "+1 bike" chip. */
export type LiveChange = {
  key: string;
  station_id: string;
  at: number;
  bikesDelta: number;
  docksDelta: number;
  closed?: boolean;
  reopened?: boolean;
};

/** How a station looks at a glance, used for card badges and map colors. */
export type Availability = "closed" | "empty" | "low" | "full" | "ok";

export function availability(s: StationStatus | undefined): Availability | null {
  if (!s) return null;
  if (!s.is_renting) return "closed";
  if (s.bikes_available === 0) return "empty";
  if (s.docks_available === 0) return "full";
  if (s.bikes_available <= 2) return "low";
  return "ok";
}
