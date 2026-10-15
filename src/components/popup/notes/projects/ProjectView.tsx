import { useState } from "react";
import { ChevronLeft, Download, FileText, Plus, Trash2 } from "lucide-react";

import NoteRow from "../NoteRow";
import ProjectIcon from "./ProjectIcon";
import { useNotesStore } from "../../../../stores/notesStore";

import type { NoteProject } from "../../../../types/notes";

/** One project: its notes, a new-note button, rename, download, delete. */
export default function ProjectView({ project }: { project: NoteProject }) {
  const openProject = useNotesStore((s) => s.openProject);
  const renameProject = useNotesStore((s) => s.renameProject);
  const deleteProject = useNotesStore((s) => s.deleteProject);
  const createNote = useNotesStore((s) => s.createNote);
  const allNotes = useNotesStore((s) => s.notes);
  const notes = allNotes.filter((n) => n.projectId === project.id);

  const [name, setName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(project.name);
      return;
    }
    if (trimmed !== project.name) renameProject(project.id, trimmed);
  };

  const iconButton =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700";

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white px-3 pb-2 pt-4">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => openProject(undefined)} aria-label="Back to all notes" className={iconButton.replace("text-neutral-400", "text-neutral-500")}>
            <ChevronLeft size={20} />
          </button>
          <ProjectIcon color={project.color} size={30} />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setName(project.name);
                e.currentTarget.blur();
              }
            }}
            aria-label="Project name"
            maxLength={80}
            className="min-w-0 flex-1 bg-transparent px-1.5 text-base font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
          />
          <button
            type="button"
            onClick={() =>
              // Export code loads on demand — it's only needed for downloads.
              void import("../projectExport").then(({ downloadProject }) =>
                downloadProject({ ...project, name: name.trim() || project.name }, notes)
              )
            }
            aria-label="Download project as ZIP"
            title="Download project (ZIP)"
            className={iconButton}
          >
            <Download size={17} />
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete project"
            title="Delete project"
            className={`${iconButton} hover:!bg-red-50 hover:!text-red-500`}
          >
            <Trash2 size={17} />
          </button>
        </div>

        {confirmDelete && (
          <div role="alertdialog" aria-label="Delete project" className="mx-1 mt-2 rounded-2xl border border-red-100 bg-red-50/60 p-3">
            <p className="text-sm font-medium text-neutral-800">Delete “{project.name}”?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              {notes.length === 0
                ? "The project is empty."
                : notes.length === 1
                  ? "Its note won't be deleted — it'll move to Notes."
                  : `Its ${notes.length} notes won't be deleted — they'll move to Notes.`}
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDelete(false)}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteProject(project.id)}
                className="rounded-xl bg-red-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
              >
                Delete project
              </button>
            </div>
          </div>
        )}

        <div className="mt-2.5 flex items-center gap-2 px-1">
          <FileText size={13} className="text-neutral-400" />
          <span className="text-xs font-medium text-neutral-500">
            {notes.length === 0 ? "No notes yet" : `${notes.length} note${notes.length === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-1">
        {notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <ProjectIcon color={project.color} size={48} />
            <p className="mt-3 text-sm font-medium text-neutral-700">Nothing in {project.name} yet</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Create a note below, or bring existing notes here with the move button on any note.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5 py-1">
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-neutral-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => createNote(project.id)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> New note in {project.name.length > 24 ? "project" : project.name}
        </button>
      </div>
    </div>
  );
}
