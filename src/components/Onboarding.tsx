"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import type { Station } from "@/lib/types";

const PICKS = [
  "University Ave & 57th St",
  "Ellis Ave & 60th St",
  "Canal St & Adams St",
  "Clinton St & Washington Blvd",
  "Kingsbury St & Kinzie St 1",
  "DuSable Lake Shore Dr & Monroe St",
];

/**
 * A 4-step guide shown the first time someone signs in. "Seen" is saved on the
 * Clerk user, so it doesn't come back on another device. The Guide button
 * reopens it any time.
 */
export function useOnboarding() {
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const decided = useRef(false);

  useEffect(() => {
    if (!isLoaded || !user || decided.current) return;
    decided.current = true;
    // Whether to show the guide is only known once Clerk has loaded the user.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!user.unsafeMetadata?.onboardedAt) setOpen(true);
  }, [isLoaded, user]);

  const finish = () => {
    setOpen(false);
    user?.updateMetadata({ unsafeMetadata: { onboardedAt: new Date().toISOString() } }).catch(() => {});
  };
  return { open, show: () => setOpen(true), finish };
}

export function Onboarding({
  stations,
  follows,
  onFollow,
  onFinish,
  onGoTo,
}: {
  stations: Map<string, Station> | null;
  follows: string[];
  onFollow: (id: string) => void;
  onFinish: () => void;
  onGoTo: (view: "mine" | "map" | "nearby" | "system") => void;
}) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const finishRef = useRef(onFinish);
  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  // Focus the dialog once when it opens; Escape closes it.
  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finishRef.current();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const byName = new Map([...(stations?.values() ?? [])].map((s) => [s.name, s]));
  const picks = PICKS.map((n) => byName.get(n)).filter((s): s is Station => !!s);

  const steps = [
    {
      title: "Know if there's a bike before you walk over",
      body: (
        <>
          <p>This page shows live bikes, e-bikes and open docks at Chicago&apos;s Divvy stations.</p>
          <ul className="mt-3 space-y-2">
            <Point icon="⟳">A worker checks Divvy every 30 seconds and saves only what changed.</Point>
            <Point icon="⚡">Changes are pushed to this page. You never need to refresh.</Point>
            <Point icon="●">
              The bar at the top tells you how fresh the data is: <b className="text-emerald-700">Live</b>,{" "}
              <b className="text-amber-700">out of date</b> or <b className="text-red-700">down</b>.
            </Point>
          </ul>
        </>
      ),
    },
    {
      title: "Follow the stations you use",
      body: (
        <>
          <p>Pick a few now. Busy ones change every few minutes, so you&apos;ll see updates arrive. You can search for any station later.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {picks.map((s) => {
              const on = follows.includes(s.station_id);
              return (
                <button
                  key={s.station_id}
                  onClick={() => onFollow(s.station_id)}
                  disabled={on}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-sky-500 bg-sky-50 text-sky-800" : "border-stone-300 hover:border-sky-500"}`}
                >
                  {on ? "✓ " : "+ "}
                  {s.name}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-stone-500">{follows.length} following. Only you can see this list.</p>
        </>
      ),
    },
    {
      title: "Reading a station card",
      body: (
        <ul className="space-y-2">
          <Point icon="3">Big numbers: classic bikes, e-bikes and open docks right now.</Point>
          <Point icon="▦">The squares are the docks: dark = classic, light = e-bike, white = open, striped = out of service.</Point>
          <Point icon="〰">The chart shows bikes over the last 24 hours. Hover it to read any moment.</Point>
          <Point icon="!">A badge warns when a station is empty, full or closed, and suggests the closest one with bikes.</Point>
          <Point icon="🔔">Tap the bell to be alerted when that station runs out or gets bikes back.</Point>
        </ul>
      ),
    },
    {
      title: "Three more views",
      body: (
        <div className="grid gap-2">
          {(
            [
              ["map", "◍ Map", "Every station, colored by availability. Tap a dot for directions."],
              ["nearby", "◎ Near me", "The closest station with a bike, an e-bike or an open dock."],
              ["system", "⚙ System", "How the data gets here, and the worker's last 60 runs."],
            ] as const
          ).map(([id, name, text]) => (
            <button
              key={id}
              onClick={() => {
                onGoTo(id);
                onFinish();
              }}
              className="rounded-lg border border-stone-200 p-3 text-left hover:border-sky-500 hover:bg-sky-50"
            >
              <p className="font-medium">{name}</p>
              <p className="text-sm text-stone-600">{text}</p>
            </button>
          ))}
        </div>
      ),
    },
  ];
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-stone-900/40 p-4 backdrop-blur-sm sm:items-center" onClick={onFinish}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-600">
            Step {step + 1} of {steps.length}
          </p>
          <button onClick={onFinish} className="text-sm text-stone-500 hover:text-stone-800">
            Skip
          </button>
        </div>
        <h2 id="onboarding-title" className="mt-2 text-xl font-semibold tracking-tight">
          {steps[step].title}
        </h2>
        <div className="mt-3 text-sm leading-relaxed text-stone-700">{steps[step].body}</div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex gap-1.5" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-sky-600" : "w-1.5 bg-stone-300"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {step > 0 && (
              <button onClick={() => setStep(step - 1)} className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
                Back
              </button>
            )}
            <button
              onClick={() => (last ? onFinish() : setStep(step + 1))}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
            >
              {last ? "Start watching" : step === 1 && follows.length === 0 ? "Skip for now" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Point({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-50 text-[11px] font-semibold text-sky-700">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
