import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

function Logo() {
  return (
    <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sm">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="16" r="3.5" />
        <circle cx="18" cy="16" r="3.5" />
        <path d="M6 16l4-7h5l3 7M10 9l-1.5-3H6M14 9l1-3h2.5" />
      </svg>
    </span>
  );
}

const FEATURES = [
  { icon: "⚡", title: "Live, no refresh", text: "Counts change on your screen within seconds of Divvy reporting them." },
  { icon: "◍", title: "Map of every station", text: "2,000+ stations colored by bikes, e-bikes and open docks." },
  { icon: "◎", title: "Near me", text: "The closest bike, e-bike or open dock, with walking directions." },
  { icon: "🔔", title: "Alerts", text: "Know when your station runs out, or gets bikes back." },
];

/** A static example card for the signed-out page, so people see what they'll get. */
function PreviewCard() {
  const cells = [...Array(4).fill("bg-sky-700"), ...Array(3).fill("bg-sky-400"), ...Array(12).fill("bg-white ring-1 ring-inset ring-stone-300")];
  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-br from-sky-200/60 via-white to-emerald-100/60 blur-2xl" />
      <div className="rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-xl">
        <div className="flex items-center justify-between">
          <p className="font-semibold">University Ave &amp; 57th St</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">● Live</span>
        </div>
        <div className="mt-4 grid grid-cols-3 text-center">
          {[
            ["4", "Classic bikes", ""],
            ["3", "E-bikes", "text-sky-600"],
            ["12", "Open docks", ""],
          ].map(([n, l, c]) => (
            <div key={l}>
              <p className={`text-3xl font-semibold ${c}`}>{n}</p>
              <p className="text-xs text-stone-500">{l}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-[3px]">
          {cells.map((c, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-[2px] ${c}`} />
          ))}
        </div>
        <svg viewBox="0 0 280 48" className="mt-4 h-12 w-full" preserveAspectRatio="none" aria-hidden>
          <path d="M0,30 H40 V22 H90 V34 H130 V14 H190 V26 H240 V18 H280 V48 H0 Z" fill="rgb(14 165 233 / 0.15)" />
          <path d="M0,30 H40 V22 H90 V34 H130 V14 H190 V26 H240 V18 H280" fill="none" stroke="rgb(2 132 199)" strokeWidth="1.5" />
        </svg>
        <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
          <span>
            <span className="text-stone-700">↓ 9</span> taken · <span className="text-stone-700">↑ 7</span> returned
          </span>
          <span className="flash-chip rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">+1 bike</span>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">Example card</p>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-[1100] border-b border-stone-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
          <h1 className="flex items-center gap-2.5 text-lg font-semibold tracking-tight">
            <Logo />
            <span>
              Divvy <span className="text-sky-700">Live</span>
            </span>
          </h1>
          <Suspense>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </Suspense>
        </div>
      </header>

      <main className="flex-1">
        {/* Sign-in state is read per request, so this part streams in after the shell. */}
        <Suspense fallback={<p className="px-6 py-20 text-center text-sm text-stone-500">Loading…</p>}>
          <Show when="signed-in">
            <Dashboard />
          </Show>

          <Show when="signed-out">
            <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-12 pt-16 lg:grid-cols-[1.1fr_1fr] lg:pt-24">
              <div className="text-center lg:text-left">
                <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                  <span className="live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" /> Chicago bike share, live
                </p>
                <h2 className="mt-5 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                  Know if there&apos;s a bike <span className="text-sky-700">before you walk over.</span>
                </h2>
                <p className="mt-5 text-lg text-stone-600 text-pretty">
                  Follow the Divvy stations near your home, class or office. Bikes, e-bikes and open docks update on their
                  own every 30 seconds. You never need to refresh.
                </p>
                <div className="mt-8 flex justify-center gap-3 lg:justify-start">
                  <SignUpButton>
                    <button className="rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white shadow-sm shadow-sky-600/30 transition hover:bg-sky-700">
                      Get started, it&apos;s free
                    </button>
                  </SignUpButton>
                  <SignInButton>
                    <button className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium transition hover:bg-stone-50">
                      Sign in
                    </button>
                  </SignInButton>
                </div>
              </div>
              <PreviewCard />
            </section>

            <section className="mx-auto max-w-6xl px-6 pb-20">
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((f) => (
                  <li key={f.title} className="rounded-2xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                    <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-lg text-sky-700">
                      {f.icon}
                    </span>
                    <p className="mt-3 font-semibold">{f.title}</p>
                    <p className="mt-1 text-sm text-stone-600">{f.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          </Show>
        </Suspense>
      </main>

      <footer className="border-t border-stone-200 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-6 py-5 text-xs text-stone-500 sm:flex-row sm:justify-between">
          <p>Data: Divvy&apos;s public GBFS feed, checked every 30 s. Not affiliated with Divvy or Lyft.</p>
          <p>
            <a href="https://github.com/YitingChen-coder/Chicago-Divvy-Live-Tracker" className="underline hover:text-stone-800">
              Source on GitHub
            </a>{" "}
            · MPCS 51238
          </p>
        </div>
      </footer>
    </>
  );
}
