import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  title: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  /** Return false to signal an incorrect PIN (keeps the prompt open). */
  onSubmit: (pin: string) => Promise<boolean | void> | boolean | void;
  onCancel: () => void;
};

export default function PinPrompt({
  title,
  confirmLabel,
  tone = "default",
  onSubmit,
  onCancel,
}: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pin || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    const result = await onSubmit(pin);
    setBusy(false);
    if (result === false) {
      setError("Incorrect PIN");
      setPin("");
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
      <p className="mb-2 px-0.5 text-xs font-medium text-neutral-600">
        {title}
      </p>
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder="PIN"
          className="h-9 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-400"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!pin || busy}
          className={[
            "h-9 shrink-0 rounded-lg px-3 text-xs font-medium text-white transition-opacity disabled:opacity-40",
            tone === "danger"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-neutral-900 hover:opacity-90",
          ].join(" ")}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 transition-colors hover:bg-white"
        >
          <X size={16} />
        </button>
      </div>
      {error && (
        <p className="mt-1.5 px-0.5 text-[11px] text-red-500">{error}</p>
      )}
    </div>
  );
}
