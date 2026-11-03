export type Station = {
  station_id: string;
  name: string;
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
