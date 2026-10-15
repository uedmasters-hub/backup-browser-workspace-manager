import { Suspense, lazy, useEffect } from "react";

import { useNotesStore } from "../../../stores/notesStore";

import NotesList from "./NotesList";

// The rich-text editor is large; it loads only when Notes opens, so the rest
// of the popup starts as fast as before.
const loadEditor = () => import("./NoteEditor");
const NoteEditor = lazy(loadEditor);

export default function NotesPanel() {
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const activeNoteId = useNotesStore((s) => s.activeNoteId);
  const activeNote = useNotesStore((s) =>
    s.notes.find((n) => n.id === s.activeNoteId)
  );

  useEffect(() => {
    void loadNotes();
    void loadEditor(); // warm it up while the list is showing
  }, [loadNotes]);

  if (activeNoteId && activeNote) {
    return (
      <Suspense fallback={<div className="absolute inset-0 z-20 bg-white" />}>
        <NoteEditor note={activeNote} />
      </Suspense>
    );
  }

  return <NotesList />;
}
