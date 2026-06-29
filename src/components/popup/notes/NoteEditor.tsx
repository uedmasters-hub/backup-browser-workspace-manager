import { useEffect, useState } from "react";
import {
  ChevronLeft,
  Download,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";

import { useNotesStore } from "../../../stores/notesStore";

import BlockRenderer from "./blocks/BlockRenderer";
import PinPrompt from "./PinPrompt";
import { noteToText } from "./serialize";

import type { Note } from "../../../types/notes";

export default function NoteEditor({ note }: { note: Note }) {
  const closeNote = useNotesStore((s) => s.closeNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const updateNoteTitle = useNotesStore((s) => s.updateNoteTitle);
  const ensureTrailingBlock = useNotesStore((s) => s.ensureTrailingBlock);
  const lockNote = useNotesStore((s) => s.lockNote);
  const removeLock = useNotesStore((s) => s.removeLock);
  const revealNote = useNotesStore((s) => s.revealNote);
  const verifyNotePin = useNotesStore((s) => s.verifyNotePin);
  const revealedId = useNotesStore((s) => s.revealedId);

  const [mode, setMode] = useState<null | "lock">(null);

  const locked = Boolean(note.locked);
  const revealed = revealedId === note.id;
  const secured = locked && !revealed;

  // A note must have at least one block to type into (never for a
  // locked-and-hidden note — that would create plaintext blocks).
  useEffect(() => {
    if (!secured && note.blocks.length === 0) {
      ensureTrailingBlock();
    }
  }, [secured, note.blocks.length, ensureTrailingBlock]);

  function download() {
    const text = noteToText(note);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${note.title.trim() || "note"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ----- Locked & hidden: a gate. No content, no export, no plain delete. -----
  if (secured) {
    return (
      <LockedGate
        title={note.title}
        onBack={() => void closeNote()}
        onReveal={(pin) => revealNote(note.id, pin)}
        onDelete={(pin) => verifyNotePin(note.id, pin)}
        deleteNote={() => deleteNote(note.id)}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white px-3 pb-2 pt-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void closeNote()}
            aria-label="Back to notes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100"
          >
            <ChevronLeft size={20} />
          </button>

          <input
            value={note.title}
            onChange={(e) => updateNoteTitle(note.id, e.target.value)}
            placeholder="Untitled"
            className="min-w-0 flex-1 bg-transparent px-1 text-base font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
          />

          <button
            type="button"
            onClick={() => (locked ? removeLock(note.id) : setMode("lock"))}
            aria-label={locked ? "Remove lock" : "Lock note"}
            title={
              locked
                ? "Locked & encrypted · tap to remove the lock"
                : "Lock note (encrypt with a PIN)"
            }
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              locked
                ? "text-amber-500 hover:bg-amber-50"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700",
            ].join(" ")}
          >
            {locked ? <Lock size={17} /> : <LockOpen size={17} />}
          </button>

          <button
            type="button"
            onClick={download}
            aria-label="Download as text"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
          >
            <Download size={17} />
          </button>
          <button
            type="button"
            onClick={() => deleteNote(note.id)}
            aria-label="Delete note"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500"
          >
            <Trash2 size={17} />
          </button>
        </div>

        {mode === "lock" && (
          <div className="mt-2 px-1">
            <PinPrompt
              title="Set a PIN to encrypt this note"
              confirmLabel="Lock"
              onCancel={() => setMode(null)}
              onSubmit={async (pin) => {
                await lockNote(note.id, pin);
                setMode(null);
                return true;
              }}
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3">
        <div
          className="space-y-1.5 py-1"
          onBlur={() => ensureTrailingBlock()}
        >
          {note.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} />
          ))}
        </div>
      </div>
    </div>
  );
}

function LockedGate({
  title,
  onBack,
  onReveal,
  onDelete,
  deleteNote,
}: {
  title: string;
  onBack: () => void;
  onReveal: (pin: string) => Promise<boolean>;
  onDelete: (pin: string) => Promise<boolean>;
  deleteNote: () => void;
}) {
  const [mode, setMode] = useState<"unlock" | "delete">("unlock");
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const danger = mode === "delete";

  async function submit() {
    if (!pin || busy) {
      return;
    }
    setBusy(true);
    setError(false);
    const ok =
      mode === "unlock" ? await onReveal(pin) : await onDelete(pin);
    setBusy(false);
    if (ok) {
      if (mode === "delete") {
        deleteNote();
      }
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
          aria-label="Back to notes"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100"
        >
          <ChevronLeft size={20} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-7 pb-10 text-center">
        <div
          className={[
            "mb-5 flex h-16 w-16 items-center justify-center rounded-3xl ring-8 transition-colors",
            danger
              ? "bg-red-50 text-red-500 ring-red-50/60"
              : "bg-amber-50 text-amber-500 ring-amber-50/60",
          ].join(" ")}
        >
          <Lock size={28} strokeWidth={2.25} />
        </div>

        <h2 className="max-w-[17rem] truncate text-base font-semibold text-neutral-900">
          {title.trim() || "Untitled"}
        </h2>
        <p className="mt-1.5 max-w-[15rem] text-xs leading-relaxed text-neutral-400">
          {danger
            ? "Enter your PIN to permanently delete this encrypted note."
            : "This note is encrypted. Enter your PIN to view, edit or export it."}
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
              error
                ? "border-red-300 focus:border-red-400"
                : "border-neutral-200 focus:border-neutral-900",
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
            danger
              ? "bg-red-600 hover:bg-red-700"
              : "bg-neutral-900 hover:opacity-90",
          ].join(" ")}
        >
          {mode === "unlock" ? "Unlock" : "Delete note"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "unlock" ? "delete" : "unlock"));
            setPin("");
            setError(false);
          }}
          className={[
            "mt-4 text-xs font-medium transition-colors",
            danger
              ? "text-neutral-400 hover:text-neutral-700"
              : "text-neutral-300 hover:text-red-500",
          ].join(" ")}
        >
          {mode === "unlock" ? "Delete this note" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
