import { useState } from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Lock,
  ShieldCheck,
} from "lucide-react";

import BlockShell from "./BlockShell";
import { useCopy } from "../useCopy";
import { useNotesStore } from "../../../../stores/notesStore";
import {
  decryptSecret,
  encryptSecret,
} from "../../../../browser/notes/passwordCrypto";
import type { PasswordBlock } from "../../../../types/notes";

export default function PasswordBlockView({
  block,
}: {
  block: PasswordBlock;
}) {
  const updateBlock = useNotesStore((s) => s.updateBlock);
  const [copied, copy] = useCopy();

  const locked = Boolean(block.cipher);

  // setup (unconfigured)
  const [secret, setSecret] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  // unlock
  const [prompting, setPrompting] = useState(false);
  const [unlockPin, setUnlockPin] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function lock() {
    if (!secret || pin.length < 4) return;
    setBusy(true);
    const enc = await encryptSecret(secret, pin);
    setBusy(false);
    setSecret("");
    setPin("");
    updateBlock(block.id, { cipher: enc.cipher, iv: enc.iv, salt: enc.salt });
  }

  async function unlock() {
    if (!block.cipher || !block.iv || !block.salt) return;
    try {
      const value = await decryptSecret(
        { cipher: block.cipher, iv: block.iv, salt: block.salt },
        unlockPin
      );
      setRevealed(value);
      setPrompting(false);
      setUnlockPin("");
      setError(false);
    } catch {
      setError(true);
    }
  }

  // --- setup ---
  if (!locked) {
    return (
      <BlockShell id={block.id}>
        <div className="rounded-xl border border-neutral-200 bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-neutral-500">
            <Lock size={13} /> New password
          </div>
          <input
            value={block.label}
            placeholder="Label (e.g. Staging DB)"
            onChange={(e) => updateBlock(block.id, { label: e.target.value })}
            className="mb-2 w-full rounded-lg bg-neutral-50 px-2.5 py-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
          />
          <div className="flex items-center gap-2">
            <input
              value={secret}
              placeholder="Secret value"
              onChange={(e) => setSecret(e.target.value)}
              className="w-full rounded-lg bg-neutral-50 px-2.5 py-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
            />
            <input
              value={pin}
              inputMode="numeric"
              type="password"
              placeholder="PIN"
              onChange={(e) => setPin(e.target.value)}
              className="w-24 rounded-lg bg-neutral-50 px-2.5 py-2 text-sm text-neutral-800 outline-none placeholder:text-neutral-300"
            />
            <button
              type="button"
              disabled={!secret || pin.length < 4 || busy}
              onClick={() => void lock()}
              className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition-opacity disabled:opacity-30"
            >
              Lock
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-neutral-400">
            Encrypted with your PIN. Only this block unlocks.
          </p>
        </div>
      </BlockShell>
    );
  }

  // --- revealed ---
  if (revealed !== null) {
    return (
      <BlockShell id={block.id}>
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-500">
            <ShieldCheck size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-800">
              {block.label || "Password"}
            </p>
            <p className="truncate font-mono text-xs text-neutral-600">
              {revealed}
            </p>
          </div>
          <button
            type="button"
            onClick={() => copy(revealed)}
            aria-label="Copy secret"
            className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            {copied ? (
              <Check size={15} className="text-emerald-500" />
            ) : (
              <Copy size={15} />
            )}
          </button>
          <button
            type="button"
            onClick={() => setRevealed(null)}
            aria-label="Hide secret"
            className="shrink-0 rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <EyeOff size={15} />
          </button>
        </div>
      </BlockShell>
    );
  }

  // --- locked (compact; PIN field appears only on demand) ---
  return (
    <BlockShell id={block.id}>
      <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
          <Lock size={16} />
        </div>

        {prompting ? (
          <input
            autoFocus
            value={unlockPin}
            type="password"
            inputMode="numeric"
            placeholder={`PIN for ${block.label || "password"}`}
            onChange={(e) => {
              setUnlockPin(e.target.value);
              setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void unlock();
              if (e.key === "Escape") {
                setPrompting(false);
                setUnlockPin("");
              }
            }}
            className={[
              "min-w-0 flex-1 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-800 outline-none placeholder:text-neutral-300",
              error ? "ring-1 ring-red-300" : "",
            ].join(" ")}
          />
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-800">
            {block.label || "Password"}
          </p>
        )}

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (prompting ? void unlock() : setPrompting(true))}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
        >
          <Eye size={14} /> {prompting ? "Open" : "Unlock"}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 pl-1 text-[11px] text-red-500">
          Incorrect PIN. Try again.
        </p>
      )}
    </BlockShell>
  );
}
