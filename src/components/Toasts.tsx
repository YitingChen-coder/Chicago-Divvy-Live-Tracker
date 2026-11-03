import type { Toast } from "@/lib/alerts";

/** Alerts for watched stations, bottom-right; each disappears after 10 s. */
export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div aria-live="assertive" className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`toast-in pointer-events-auto rounded-xl border bg-white p-4 shadow-lg ${t.tone === "good" ? "border-emerald-300" : "border-red-300"}`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">
              <span aria-hidden>{t.tone === "good" ? "🟢 " : "🔴 "}</span>
              {t.title}
            </p>
            <button onClick={() => onDismiss(t.id)} aria-label="Dismiss" className="text-stone-400 hover:text-stone-700">✕</button>
          </div>
          <p className="mt-1 text-sm text-stone-600">{t.body}</p>
        </div>
      ))}
    </div>
  );
}
