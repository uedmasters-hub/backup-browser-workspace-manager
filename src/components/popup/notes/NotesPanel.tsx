import { useEffect } from "react";

import { useNotesStore } from "../../../stores/notesStore";

import NotesList from "./NotesList";
import NoteEditor from "./NoteEditor";

export default function NotesPanel() {
  const loadNotes = useNotesStore((s) => s.loadNotes);
  const activeNoteId = useNotesStore((s) => s.activeNoteId);
  const activeNote = useNotesStore((s) =>
    s.notes.find((n) => n.id === s.activeNoteId)
  );

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  if (activeNoteId && activeNote) {
    return <NoteEditor note={activeNote} />;
  }

  return <NotesList />;
}
