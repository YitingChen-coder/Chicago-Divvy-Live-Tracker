// Pure logic for the worker: parse the Divvy feed and decide what changed.
// No network or database here, so it can be tested on a saved copy of the feed.

export type StatusRow = {
  station_id: string;
  bikes_available: number;
  ebikes_available: number;
  docks_available: number;
  is_renting: boolean;
  last_reported: string | null;
};

export type StationRow = {
  station_id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number | null;
};

export type ParsedStatus = { sourceUpdatedAt: string; rows: StatusRow[] };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const toIso = (unixSeconds: unknown) =>
  isNum(unixSeconds) && unixSeconds > 0 ? new Date(unixSeconds * 1000).toISOString() : null;

/** Turn station_status.json into rows. Throws if the feed's shape is not what we expect. */
export function parseStatusFeed(json: unknown): ParsedStatus {
  const feed = json as { last_updated?: unknown; data?: { stations?: unknown } };
  const stations = feed?.data?.stations;
  if (!Array.isArray(stations) || !isNum(feed.last_updated)) {
    throw new Error("station_status feed has an unexpected shape (no data.stations or last_updated)");
  }
  const rows: StatusRow[] = [];
  for (const s of stations as Record<string, unknown>[]) {
    if (typeof s.station_id !== "string" || !isNum(s.num_bikes_available) || !isNum(s.num_docks_available)) {
      continue; // skip a malformed station rather than failing the whole run
    }
    rows.push({
      station_id: s.station_id,
      bikes_available: s.num_bikes_available,
      ebikes_available: isNum(s.num_ebikes_available) ? s.num_ebikes_available : 0,
      docks_available: s.num_docks_available,
      is_renting: s.is_renting === 1 || s.is_renting === true,
      last_reported: toIso(s.last_reported),
    });
  }
  if (rows.length === 0) throw new Error("station_status feed contained no valid stations");
  return { sourceUpdatedAt: toIso(feed.last_updated)!, rows };
}

/** Turn station_information.json into rows. */
export function parseInfoFeed(json: unknown): StationRow[] {
  const stations = (json as { data?: { stations?: unknown } })?.data?.stations;
  if (!Array.isArray(stations)) throw new Error("station_information feed has an unexpected shape");
  return (stations as Record<string, unknown>[])
    .filter((s) => typeof s.station_id === "string" && typeof s.name === "string" && isNum(s.lat) && isNum(s.lon))
    .map((s) => ({
      station_id: s.station_id as string,
      name: (s.name as string).trim(),
      lat: s.lat as number,
      lon: s.lon as number,
      capacity: isNum(s.capacity) ? s.capacity : null,
    }));
}

/**
 * Which status rows need saving: stations we have never seen, or whose bikes,
 * e-bikes, docks or renting flag changed. A newer last_reported alone does NOT
 * count — about 14x more stations check in than actually change.
 */
export function changedStatusRows(incoming: StatusRow[], current: Map<string, StatusRow>): StatusRow[] {
  return incoming.filter((row) => {
    const old = current.get(row.station_id);
    return (
      !old ||
      old.bikes_available !== row.bikes_available ||
      old.ebikes_available !== row.ebikes_available ||
      old.docks_available !== row.docks_available ||
      old.is_renting !== row.is_renting
    );
  });
}

/** Which station rows are new or have a changed name, location or capacity. */
export function changedStationRows(incoming: StationRow[], current: Map<string, StationRow>): StationRow[] {
  return incoming.filter((row) => {
    const old = current.get(row.station_id);
    return (
      !old ||
      old.name !== row.name ||
      old.lat !== row.lat ||
      old.lon !== row.lon ||
      old.capacity !== row.capacity
    );
  });
}

export type HistoryRow = Omit<StatusRow, "last_reported"> & { recorded_at: string };

/** One history point per changed station, all stamped with the same time. */
export function historyRows(changed: StatusRow[], recordedAt: string): HistoryRow[] {
  return changed.map(({ last_reported: _ignored, ...counts }) => ({ ...counts, recorded_at: recordedAt }));
}
