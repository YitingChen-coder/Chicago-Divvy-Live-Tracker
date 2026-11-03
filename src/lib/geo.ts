"use client";

import { useCallback, useState } from "react";

export type LatLon = { lat: number; lon: number };

/** Straight-line distance in meters (haversine). */
export function distanceM(a: LatLon, b: LatLon): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Walking minutes, assuming city blocks add ~30% to the straight line at 80 m/min. */
export const walkMinutes = (meters: number) => Math.max(1, Math.round((meters * 1.3) / 80));

export function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 0.1 ? `${Math.round(meters * 3.281)} ft` : `${miles.toFixed(miles < 10 ? 1 : 0)} mi`;
}

/** Google Maps walking directions to a point. Works on phones (opens the app) and desktop. */
export const directionsUrl = ({ lat, lon }: LatLon) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;

/** Downtown Chicago, used when we don't know where the person is. */
export const CHICAGO: LatLon = { lat: 41.8819, lon: -87.6278 };

export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "ok"; position: LatLon; accuracyM: number }
  | { status: "error"; message: string };

/** Asks for the browser's location only when the person clicks a button. */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "error", message: "This browser can't share its location." });
      return;
    }
    setState({ status: "locating" });
    navigator.geolocation.getCurrentPosition(
      (p) => setState({ status: "ok", position: { lat: p.coords.latitude, lon: p.coords.longitude }, accuracyM: p.coords.accuracy }),
      (e) =>
        setState({
          status: "error",
          message: e.code === e.PERMISSION_DENIED ? "Location permission was denied. You can still pick stations on the map." : "Couldn't get your location. Try again.",
        }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);
  return { geo: state, locate };
}
