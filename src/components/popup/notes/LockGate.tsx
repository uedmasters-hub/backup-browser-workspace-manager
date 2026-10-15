import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, Lock } from "lucide-react";

/**
 * Full-panel PIN screen for anything encrypted — a locked note or a locked
 * project. Optional "delete with PIN" mode for things that can be removed
 * from here.
 */
export default function LockGate({
  title,
  subtitle,
  badge,
  backLabel,
  onBack,
  onUnlock,
  remove,
}: {
  title: string;
  subtitle: string;
  /** Shown beside the title (e.g. the project's icon). */
  badge?: ReactNode;
  backLabel: string;
  onBack: () => void;
  onUnlock: (pin: string) => Promise<boolean>;
  remove?: {
    toggleLabel: string;
    subtitle: string;
    confirmLabel: string;
    verify: (pin: string) => Promise<boolean>;
    onRemoved: () => void;
  };
}) {
  const [mode, setMode] = useState<"unlock" | "delete">("unlock");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const danger = mode === "delete" && Boolean(remove);

  async function submit() {
    if (!pin || busy) return;
    setBusy(true);
    setError(false);
    const ok = danger ? await remove!.verify(pin) : await onUnlock(pin);
    setBusy(false);
    if (ok) {
      if (danger) remove!.onRemoved();
      return;
    }
    setError(true);
    setPin("");
    setShakeKey((k) => k + 1);
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="shrink-0 px-3 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-7 pb-10 text-center">
        <div
          className={[
            "mb-5 flex h-16 w-16 items-center justify-center rounded-3xl ring-8 transition-colors",
            danger ? "bg-red-50 text-red-500 ring-red-50/60" : "bg-amber-50 text-amber-500 ring-amber-50/60",
          ].join(" ")}
        >
          <Lock size={28} strokeWidth={2.25} />
        </div>

        <h2 className="flex max-w-[17rem] items-center gap-2 text-base font-semibold text-neutral-900">
          {badge}
          <span className="truncate">{title.trim() || "Untitled"}</span>
        </h2>
        <p className="mt-1.5 max-w-[15rem] text-xs leading-relaxed text-neutral-400">
          {danger ? remove!.subtitle : subtitle}
        </p>

        <div key={shakeKey} className={error ? "animate-shake" : ""}>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                onBack();
              }
            }}
            placeholder="••••"
            aria-label="PIN"
            className={[
              "mt-6 h-12 w-56 rounded-2xl border bg-white text-center text-lg tracking-[0.5em] text-neutral-900 outline-none transition-colors placeholder:tracking-[0.4em] placeholder:text-neutral-300",
              error ? "border-red-300 focus:border-red-400" : "border-neutral-200 focus:border-neutral-900",
            ].join(" ")}
          />
        </div>

        <p
          className={[
            "mt-2 h-4 text-[11px] font-medium transition-opacity",
            error ? "text-red-500 opacity-100" : "opacity-0",
          ].join(" ")}
        >
          Incorrect PIN
        </p>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!pin || busy}
          className={[
            "mt-3 h-11 w-56 rounded-2xl text-sm font-medium text-white transition-opacity disabled:opacity-40",
            danger ? "bg-red-600 hover:bg-red-700" : "bg-neutral-900 hover:opacity-90",
          ].join(" ")}
        >
          {busy ? (danger ? "Checking…" : "Unlocking…") : danger ? remove!.confirmLabel : "Unlock"}
        </button>

        {remove && (
          <button
            type="button"
            onClick={() => {
              setMode((m) => (m === "unlock" ? "delete" : "unlock"));
              setPin("");
              setError(false);
            }}
            className={[
              "mt-4 text-xs font-medium transition-colors",
              danger ? "text-neutral-400 hover:text-neutral-700" : "text-neutral-300 hover:text-red-500",
            ].join(" ")}
          >
            {mode === "unlock" ? remove.toggleLabel : "Cancel"}
          </button>
        )}
      </div>
    </div>
  );
}
