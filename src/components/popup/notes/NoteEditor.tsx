import { useEffect, useState } from "react";
import {
  ChevronLeft,
  FolderInput,
  MoreVertical,
  Download,
  Lock,
  LockOpen,
  Trash2,
} from "lucide-react";

import { useNotesStore } from "../../../stores/notesStore";

import BlockRenderer from "./blocks/BlockRenderer";
import PinPrompt from "./PinPrompt";
import LockGate from "./LockGate";
import MoveToProjectMenu from "./projects/MoveToProjectMenu";
import DropdownMenu, { MenuDivider, MenuRow } from "./menus/DropdownMenu";
import { noteToText } from "./serialize";

import type { Note } from "../../../types/notes";

export default function NoteEditor({ note }: { note: Note }) {
  const closeNote = useNotesStore((s) => s.closeNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const updateNoteTitle = useNotesStore((s) => s.updateNoteTitle);
  const ensureTrailingBlock = useNotesStore((s) => s.ensureTrailingBlock);
  const normalizeTextBlocks = useNotesStore((s) => s.normalizeTextBlocks);
  const lockNote = useNotesStore((s) => s.lockNote);
  const removeLock = useNotesStore((s) => s.removeLock);
  const revealNote = useNotesStore((s) => s.revealNote);
  const verifyNotePin = useNotesStore((s) => s.verifyNotePin);
  const revealedId = useNotesStore((s) => s.revealedId);

  const [mode, setMode] = useState<null | "lock">(null);
  const [moveAnchor, setMoveAnchor] = useState<DOMRect | null>(null);
  const [actionsAnchor, setActionsAnchor] = useState<DOMRect | null>(null);
  const project = useNotesStore((s) =>
    note.projectId ? s.projects.find((p) => p.id === note.projectId) : undefined
  );

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

  // Older notes kept one line per Text block; join neighbours once on open so
  // formatting and selection work across lines.
  useEffect(() => {
    if (!secured) normalizeTextBlocks();
  }, [secured, note.id, normalizeTextBlocks]);

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
      <LockGate
        title={note.title}
        subtitle="This note is encrypted. Enter your PIN to view, edit or export it."
        backLabel="Back to notes"
        onBack={() => void closeNote()}
        onUnlock={(pin) => revealNote(note.id, pin)}
        remove={{
          toggleLabel: "Delete this note",
          subtitle: "Enter your PIN to permanently delete this encrypted note.",
          confirmLabel: "Delete note",
          verify: (pin) => verifyNotePin(note.id, pin),
          onRemoved: () => deleteNote(note.id),
        }}
      />
    );
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white px-3 pb-2 pt-4">
        {/* Row 1 — back · title · move to project · more */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void closeNote()}
            aria-label="Back to notes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100"
          >
            <ChevronLeft size={20} />
          </button>

          {locked && (
            <Lock
              size={13}
              className="ml-1 shrink-0 text-amber-500"
              aria-label="Locked and encrypted"
            />
          )}
          <input
            value={note.title}
            onChange={(e) => updateNoteTitle(note.id, e.target.value)}
            placeholder="Untitled"
            aria-label="Note title"
            className="min-w-0 flex-1 bg-transparent px-1 text-base font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
          />

          <button
            type="button"
            onClick={(e) => setMoveAnchor(e.currentTarget.getBoundingClientRect())}
            aria-haspopup="menu"
            aria-expanded={Boolean(moveAnchor)}
            aria-label={project ? `Move to project (in ${project.name})` : "Move to project"}
            title={project ? `In ${project.name} · move` : "Move to project"}
            style={project ? { color: project.color } : undefined}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-neutral-100",
              project ? "" : "text-neutral-400 hover:text-neutral-700",
            ].join(" ")}
          >
            <FolderInput size={17} />
          </button>
          {moveAnchor && (
            <MoveToProjectMenu noteId={note.id} anchor={moveAnchor} onClose={() => setMoveAnchor(null)} />
          )}

          <button
            type="button"
            onClick={(e) => setActionsAnchor(e.currentTarget.getBoundingClientRect())}
            aria-label="More actions"
            title="More actions"
            aria-haspopup="menu"
            aria-expanded={Boolean(actionsAnchor)}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              actionsAnchor
                ? "bg-neutral-100 text-neutral-800"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700",
            ].join(" ")}
          >
            <MoreVertical size={17} />
          </button>
          {actionsAnchor && (
            <DropdownMenu anchor={actionsAnchor} onClose={() => setActionsAnchor(null)} label="Note actions" width={216}>
              <MenuRow
                icon={locked ? <Lock size={14} /> : <LockOpen size={14} />}
                tone={locked ? "warning" : "default"}
                label={locked ? "Remove lock" : "Lock note"}
                onSelect={() => {
                  setActionsAnchor(null);
                  if (locked) removeLock(note.id);
                  else setMode("lock");
                }}
              />
              <MenuRow
                icon={<Download size={14} />}
                label="Download as text"
                onSelect={() => {
                  setActionsAnchor(null);
                  download();
                }}
              />
              <MenuDivider />
              <MenuRow
                icon={<Trash2 size={14} />}
                tone="danger"
                label="Delete note"
                onSelect={() => {
                  setActionsAnchor(null);
                  deleteNote(note.id);
                }}
              />
            </DropdownMenu>
          )}
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

      <div
        data-notes-scroll
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3"
      >
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
