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
  const unlockNote = useNotesStore((s) => s.unlockNote);
  const verifyNotePin = useNotesStore((s) => s.verifyNotePin);

  const [mode, setMode] = useState<null | "lock" | "unlock" | "delete">(
    null
  );

  const locked = Boolean(note.lock);

  // A note must have at least one block to type into.
  useEffect(() => {
    if (note.blocks.length === 0) {
      ensureTrailingBlock();
    }
  }, [note.blocks.length, ensureTrailingBlock]);

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

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white px-3 pb-2 pt-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={closeNote}
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
            onClick={() => setMode(locked ? "unlock" : "lock")}
            aria-label={locked ? "Unlock note" : "Lock note"}
            title={
              locked
                ? "Locked · PIN required to delete"
                : "Lock note (PIN to delete)"
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
            onClick={() =>
              locked ? setMode("delete") : deleteNote(note.id)
            }
            aria-label="Delete note"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-red-500"
          >
            <Trash2 size={17} />
          </button>
        </div>

        {mode && (
          <div className="mt-2 px-1">
            <PinPrompt
              title={
                mode === "lock"
                  ? "Set a PIN to lock this note"
                  : mode === "unlock"
                    ? "Enter PIN to unlock this note"
                    : "Enter PIN to delete this note"
              }
              confirmLabel={
                mode === "lock"
                  ? "Lock"
                  : mode === "unlock"
                    ? "Unlock"
                    : "Delete"
              }
              tone={mode === "delete" ? "danger" : "default"}
              onCancel={() => setMode(null)}
              onSubmit={async (pin) => {
                if (mode === "lock") {
                  await lockNote(note.id, pin);
                  setMode(null);
                  return true;
                }
                if (mode === "unlock") {
                  const ok = await unlockNote(note.id, pin);
                  if (ok) {
                    setMode(null);
                  }
                  return ok;
                }
                const ok = await verifyNotePin(note.id, pin);
                if (ok) {
                  deleteNote(note.id);
                }
                return ok;
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
