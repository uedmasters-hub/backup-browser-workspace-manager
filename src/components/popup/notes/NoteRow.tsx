import { useState } from "react";
import { FolderInput, Trash2 } from "lucide-react";

import PinPrompt from "./PinPrompt";
import NoteIcon from "./NoteIcon";
import MoveToProjectMenu from "./projects/MoveToProjectMenu";
import { ago, preview } from "./noteMeta";
import { useNotesStore } from "../../../stores/notesStore";

import type { Note } from "../../../types/notes";

/** One note in a list: document icon · title · preview · time. Hover: move · delete. */
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
        className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-50"
      >
        <NoteIcon locked={note.locked} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-neutral-800">
            {note.title.trim() || "Untitled"}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-neutral-400">
            {project && (
              <>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
                <span className="max-w-[120px] shrink-0 truncate">{project.name}</span>
                <span aria-hidden="true" className="text-neutral-300">·</span>
              </>
            )}
            <span className="truncate">{note.locked ? "Locked" : preview(note)}</span>
          </span>
        </span>
        <span
          className={[
            "shrink-0 text-[11px] text-neutral-300 transition-opacity group-hover/note:opacity-0",
            moveAnchor ? "opacity-0" : "",
          ].join(" ")}
        >
          {ago(note.updatedAt)}
        </span>
      </button>

      <div
        className={[
          "absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 transition-opacity group-hover/note:opacity-100 focus-within:opacity-100",
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
