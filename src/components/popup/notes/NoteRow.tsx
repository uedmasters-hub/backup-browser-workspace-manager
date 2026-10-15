import { useState } from "react";
import { FolderInput, Lock, Trash2 } from "lucide-react";

import PinPrompt from "./PinPrompt";
import MoveToProjectMenu from "./projects/MoveToProjectMenu";
import { ago, preview } from "./noteMeta";
import { useNotesStore } from "../../../stores/notesStore";

import type { Note } from "../../../types/notes";

/** One note in a list. Hover: move to a project · delete. */
export default function NoteRow({ note, showProject = false }: { note: Note; showProject?: boolean }) {
  const openNote = useNotesStore((s) => s.openNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const verifyNotePin = useNotesStore((s) => s.verifyNotePin);
  const project = useNotesStore((s) =>
    showProject && note.projectId ? s.projects.find((p) => p.id === note.projectId) : undefined
  );

  const [confirmPin, setConfirmPin] = useState(false);
  const [moveAnchor, setMoveAnchor] = useState<DOMRect | null>(null);

  const action =
    "rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-white hover:text-neutral-700";

  return (
    <div className="group/note relative">
      <button
        type="button"
        onClick={() => void openNote(note.id)}
        className="w-full rounded-2xl border border-transparent px-3 py-3 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-50"
      >
        <p className="flex items-center gap-1.5 truncate pr-16 text-sm font-medium text-neutral-800">
          {note.locked && <Lock size={12} className="shrink-0 text-amber-500" aria-label="Locked" />}
          <span className="truncate">{note.title.trim() || "Untitled"}</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-neutral-400">
          {note.locked ? "Locked · encrypted" : preview(note)}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-300">
          {project && (
            <>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="max-w-[160px] truncate text-neutral-400">{project.name}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          {ago(note.updatedAt)}
        </p>
      </button>

      <div
        className={[
          "absolute right-2 top-2.5 flex items-center gap-0.5 transition-opacity group-hover/note:opacity-100 focus-within:opacity-100",
          moveAnchor ? "opacity-100" : "opacity-0",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={(e) => setMoveAnchor(e.currentTarget.getBoundingClientRect())}
          aria-label="Move to project"
          title="Move to project"
          aria-haspopup="menu"
          aria-expanded={Boolean(moveAnchor)}
          className={action}
        >
          <FolderInput size={14} />
        </button>
        <button
          type="button"
          onClick={() => (note.locked ? setConfirmPin(true) : deleteNote(note.id))}
          aria-label="Delete note"
          title="Delete note"
          className="rounded-lg p-1.5 text-neutral-300 transition-colors hover:bg-white hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {moveAnchor && (
        <MoveToProjectMenu noteId={note.id} anchor={moveAnchor} onClose={() => setMoveAnchor(null)} />
      )}

      {confirmPin && (
        <div className="px-1 pb-2 pt-1">
          <PinPrompt
            title="Enter PIN to delete this locked note"
            confirmLabel="Delete"
            tone="danger"
            onCancel={() => setConfirmPin(false)}
            onSubmit={async (pin) => {
              const ok = await verifyNotePin(note.id, pin);
              if (ok) {
                deleteNote(note.id);
                setConfirmPin(false);
              }
              return ok;
            }}
          />
        </div>
      )}
    </div>
  );
}
