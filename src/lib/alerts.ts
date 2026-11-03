"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveChange, Station, StationStatus } from "./types";

export type Toast = { id: string; title: string; body: string; tone: "good" | "bad" };

const KEY = "divvy-alerts";

/** What a change means to someone waiting on this station, or null if it doesn't matter. */
export function alertFor(change: LiveChange, now: StationStatus, name: string): Omit<Toast, "id"> | null {
  const before = now.bikes_available - change.bikesDelta;
  const docksBefore = now.docks_available - change.docksDelta;
  if (change.closed) return { title: `${name} stopped renting`, body: "Pick another station.", tone: "bad" };
  if (change.reopened) return { title: `${name} is renting again`, body: `${now.bikes_available} bikes there now.`, tone: "good" };
  if (before > 0 && now.bikes_available === 0) return { title: `${name} just ran out of bikes`, body: "Check the map for the nearest one with bikes.", tone: "bad" };
  if (before === 0 && now.bikes_available > 0)
    return { title: `Bikes are back at ${name}`, body: `${now.bikes_available} available now (${now.ebikes_available} e-bikes).`, tone: "good" };
  if (docksBefore > 0 && now.docks_available === 0) return { title: `${name} is full`, body: "No open docks to return a bike.", tone: "bad" };
  return null;
}

/**
 * Per-station alerts, remembered in this browser. When a watched station runs out
 * of bikes, gets them back, fills up or closes, show a toast and (if allowed) a
 * system notification.
 */
export function useAlerts(changes: LiveChange[], statuses: Record<string, StationStatus>, stations: Map<string, Station> | null) {
  const [watched, setWatched] = useState<string[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
      // Reading browser storage has to wait until we're in the browser.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setWatched(saved);
    } catch {
      /* storage blocked: alerts just won't be remembered */
    }
  }, []);

  const toggle = useCallback((id: string) => {
    setWatched((w) => {
      const next = w.includes(id) ? w.filter((x) => x !== id) : [...w, id];
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (typeof Notification !== "undefined" && Notification.permission === "default") Notification.requestPermission();
  }, []);

  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  useEffect(() => {
    const fresh: Toast[] = [];
    for (const c of changes) {
      if (handled.current.has(c.key)) continue;
      handled.current.add(c.key);
      const st = statuses[c.station_id];
      if (!watched.includes(c.station_id) || !st) continue;
      const a = alertFor(c, st, stations?.get(c.station_id)?.name ?? "A station");
      if (!a) continue;
      fresh.push({ id: c.key, ...a });
      if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
        new Notification(a.title, { body: a.body, tag: c.station_id });
      }
    }
    if (fresh.length) {
      // Toasts come from changes pushed by Realtime, an external event.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToasts((t) => [...fresh, ...t].slice(0, 4));
      for (const f of fresh) setTimeout(() => dismiss(f.id), 10_000);
    }
  }, [changes, statuses, stations, watched, dismiss]);

  return { watched, toggle, toasts, dismiss };
}
