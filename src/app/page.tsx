import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <>
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span aria-hidden className="inline-block h-3 w-3 rounded-full bg-sky-500" />
            Divvy Live Tracker
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
            <section className="mx-auto max-w-2xl px-6 py-20 text-center">
              <p className="text-sm font-medium uppercase tracking-wide text-sky-600">Chicago bike share, live</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                Know if there&apos;s a bike before you walk over.
              </h2>
              <p className="mt-5 text-lg text-stone-600">
                Follow the Divvy stations near your home, class, or office. Bikes, e-bikes and open docks update on
                their own, every 30 seconds, with no refresh.
              </p>
              <div className="mt-8 flex justify-center gap-3">
                <SignUpButton>
                  <button className="rounded-lg bg-sky-600 px-5 py-2.5 font-medium text-white hover:bg-sky-700">
                    Get started
                  </button>
                </SignUpButton>
                <SignInButton>
                  <button className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium hover:bg-stone-50">
                    Sign in
                  </button>
                </SignInButton>
              </div>
              <p className="mt-10 text-xs text-stone-400">
                Data: Divvy&apos;s public GBFS feed. Not affiliated with Divvy or Lyft.
              </p>
            </section>
          </Show>
        </Suspense>
      </main>
    </>
  );
}
