import { useState } from "react";
import { Lock, Plus, Search, StickyNote, Trash2, X } from "lucide-react";

import { useUIStore } from "../../../stores/uiStore";
import { useNotesStore } from "../../../stores/notesStore";

import PinPrompt from "./PinPrompt";

import type { Note } from "../../../types/notes";

function preview(note: Note): string {
  for (const block of note.blocks) {
    if (block.type === "text" && block.text.trim()) return block.text.trim();
    if (block.type === "callout" && block.text.trim()) return block.text.trim();
    if (block.type === "checklist") {
      const first = block.items.find((i) => i.text.trim());
      if (first) return first.text.trim();
    }
    if (block.type === "link" && (block.label || block.url))
      return block.label || block.url;
  }
  return "Empty note";
}

function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export default function NotesList() {
  const closeNotes = useUIStore((s) => s.closeNotes);

  const notes = useNotesStore((s) => s.notes);
  const query = useNotesStore((s) => s.query);
  const setQuery = useNotesStore((s) => s.setQuery);
  const openNote = useNotesStore((s) => s.openNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);
  const createNote = useNotesStore((s) => s.createNote);
  const verifyNotePin = useNotesStore((s) => s.verifyNotePin);

  const [pendingId, setPendingId] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          preview(n).toLowerCase().includes(q)
      )
    : notes;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={closeNotes}
            aria-label="Close notes"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50"
          >
            <X size={18} />
          </button>
          <div className="flex flex-1 items-center rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <Search size={18} className="mr-3 shrink-0 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-300"
            />
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-2 px-1">
          <StickyNote size={13} className="text-neutral-400" />
          <span className="text-xs font-medium text-neutral-500">
            Notes{notes.length > 0 ? ` · ${notes.length}` : ""}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-1">
        {notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <StickyNote size={22} />
            </div>
            <p className="text-sm font-medium text-neutral-700">No notes yet</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Notes are shared across every window. Create your first one below.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-400">
            No notes match “{query}”.
          </div>
        ) : (
          <div className="space-y-1.5 py-1">
            {filtered.map((note) => (
              <div key={note.id} className="group/note relative">
                <button
                  type="button"
                  onClick={() => openNote(note.id)}
                  className="w-full rounded-2xl border border-transparent px-3 py-3 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-50"
                >
                  <p className="flex items-center gap-1.5 truncate pr-7 text-sm font-medium text-neutral-800">
                    {note.locked && (
                      <Lock
                        size={12}
                        className="shrink-0 text-amber-500"
                        aria-label="Locked"
                      />
                    )}
                    <span className="truncate">
                      {note.title.trim() || "Untitled"}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-neutral-400">
                    {note.locked ? "Locked · encrypted" : preview(note)}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-300">
                    {ago(note.updatedAt)}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    note.locked ? setPendingId(note.id) : deleteNote(note.id)
                  }
                  aria-label="Delete note"
                  className="absolute right-2 top-2.5 rounded-lg p-1.5 text-neutral-300 opacity-0 transition-opacity hover:bg-white hover:text-red-500 group-hover/note:opacity-100"
                >
                  <Trash2 size={14} />
                </button>

                {pendingId === note.id && (
                  <div className="px-1 pb-2 pt-1">
                    <PinPrompt
                      title="Enter PIN to delete this locked note"
                      confirmLabel="Delete"
                      tone="danger"
                      onCancel={() => setPendingId(null)}
                      onSubmit={async (pin) => {
                        const ok = await verifyNotePin(note.id, pin);
                        if (ok) {
                          deleteNote(note.id);
                          setPendingId(null);
                        }
                        return ok;
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => createNote()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> New note
        </button>
      </div>
    </div>
  );
}
