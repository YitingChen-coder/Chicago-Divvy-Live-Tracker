"use client";

// Leaflet touches `window`, so this file is only loaded in the browser (see MapView.tsx).
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { CHICAGO, directionsUrl, distanceLabel, distanceM, type LatLon } from "@/lib/geo";
import { AVAILABILITY_STYLE, type MapFilter } from "@/lib/mapStyle";
import { availability, type Station, type StationStatus } from "@/lib/types";

/** Moves the map when the target changes after it has opened (the first target is the initial center). */
function FlyTo({ target, zoom }: { target: LatLon | null; zoom: number }) {
  const map = useMap();
  const first = useRef(true);
  const lat = target?.lat;
  const lon = target?.lon;
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (lat != null && lon != null) map.flyTo([lat, lon], zoom, { duration: 0.8 });
  }, [map, lat, lon, zoom]);
  return null;
}

export default function StationMap({
  stations,
  statuses,
  follows,
  filter,
  focus,
  userPos,
  onFollow,
  onUnfollow,
}: {
  stations: Map<string, Station>;
  statuses: Record<string, StationStatus>;
  follows: string[];
  filter: MapFilter;
  focus: string | null;
  userPos: LatLon | null;
  onFollow: (id: string) => void;
  onUnfollow: (id: string) => void;
}) {
  const followed = useMemo(() => new Set(follows), [follows]);
  const visible = useMemo(() => {
    return [...stations.values()].filter((s) => {
      const st = statuses[s.station_id];
      if (followed.has(s.station_id)) return true; // always show my stations
      if (!st) return false;
      if (filter === "bikes") return st.is_renting && st.bikes_available > 0;
      if (filter === "ebikes") return st.is_renting && st.ebikes_available > 0;
      if (filter === "docks") return st.is_renting && st.docks_available > 0;
      return true;
    });
  }, [stations, statuses, followed, filter]);

  const focusStation = focus ? stations.get(focus) : undefined;
  const target = focusStation ? { lat: focusStation.lat, lon: focusStation.lon } : userPos;

  return (
    <MapContainer
      center={target ? [target.lat, target.lon] : [CHICAGO.lat, CHICAGO.lon]}
      zoom={focusStation ? 16 : target ? 15 : 13}
      preferCanvas
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "#e7e5e4" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FlyTo target={target} zoom={focusStation ? 16 : 15} />

      {userPos && (
        <CircleMarker center={[userPos.lat, userPos.lon]} radius={8} pathOptions={{ color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }}>
          <Tooltip direction="top" offset={[0, -8]}>You are here</Tooltip>
        </CircleMarker>
      )}

      {/* Draw followed stations last so they sit on top. */}
      {[...visible].sort((a, b) => Number(followed.has(a.station_id)) - Number(followed.has(b.station_id))).map((s) => {
        const st = statuses[s.station_id];
        const av = availability(st) ?? "closed";
        const mine = followed.has(s.station_id);
        const dist = userPos ? distanceM(userPos, s) : null;
        return (
          <CircleMarker
            key={`${s.station_id}-${mine}`}
            center={[s.lat, s.lon]}
            radius={mine ? 10 : 5}
            pathOptions={{
              color: mine ? "#0c4a6e" : "#ffffff",
              weight: mine ? 3 : 1,
              fillColor: AVAILABILITY_STYLE[av].color,
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <div className="min-w-52 font-sans">
                <p className="text-sm font-semibold text-stone-900">{s.name}</p>
                {st ? (
                  <p className="mt-1 text-xs text-stone-600">
                    <b>{st.bikes_available - st.ebikes_available}</b> classic · <b>{st.ebikes_available}</b> e-bikes ·{" "}
                    <b>{st.docks_available}</b> open docks
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-stone-500">No live data yet</p>
                )}
                <p className="mt-1 text-xs" style={{ color: AVAILABILITY_STYLE[av].color }}>
                  ● {AVAILABILITY_STYLE[av].label}
                </p>
                {dist != null && (
                  <p className="mt-1 text-xs text-stone-500">
                    {distanceLabel(dist)}
                  </p>
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => (mine ? onUnfollow(s.station_id) : onFollow(s.station_id))}
                    className={`rounded-md px-2 py-1 text-xs font-medium ${mine ? "bg-stone-100 text-stone-700" : "bg-sky-600 text-white"}`}
                  >
                    {mine ? "Unfollow" : "+ Follow"}
                  </button>
                  <a
                    href={directionsUrl(s)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-stone-300 px-2 py-1 text-xs font-medium !text-stone-700"
                  >
                    Directions ↗
                  </a>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
