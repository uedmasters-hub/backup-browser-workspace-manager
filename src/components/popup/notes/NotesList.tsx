import { useMemo, useRef, useState } from "react";
import { ChevronRight, FilePlus2, FolderPlus, Plus, StickyNote, X } from "lucide-react";

import { useUIStore } from "../../../stores/uiStore";
import { useNotesStore } from "../../../stores/notesStore";

import NoteRow from "./NoteRow";
import NotesSearch from "./NotesSearch";
import DropdownMenu, { MenuRow } from "./menus/DropdownMenu";
import ProjectIcon from "./projects/ProjectIcon";
import { ago, matchesQuery } from "./noteMeta";

import type { Note, NoteProject } from "../../../types/notes";

type ProjectSummary = { project: NoteProject; count: number; lastActive: number };

function ProjectRow({ summary, onOpen }: { summary: ProjectSummary; onOpen: () => void }) {
  const { project, count, lastActive } = summary;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-50"
    >
      <ProjectIcon color={project.color} locked={project.locked} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-neutral-800">{project.name}</span>
        <span className="block truncate text-xs text-neutral-400">
          {project.locked ? "Locked" : count === 0 ? "Empty" : `${count} note${count === 1 ? "" : "s"}`}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 text-[11px] text-neutral-300">
        {ago(lastActive)}
        <ChevronRight size={14} className="-mr-1" />
      </span>
    </button>
  );
}

/** One list: projects (folders) first, then standalone notes (documents). Search looks everywhere. */
export default function NotesList() {
  const closeNotes = useUIStore((s) => s.closeNotes);

  const notes = useNotesStore((s) => s.notes);
  const projects = useNotesStore((s) => s.projects);
  const query = useNotesStore((s) => s.query);
  const setQuery = useNotesStore((s) => s.setQuery);
  const createNote = useNotesStore((s) => s.createNote);
  const createProject = useNotesStore((s) => s.createProject);
  const openProject = useNotesStore((s) => s.openProject);

  const [newProject, setNewProject] = useState<string | null>(null);
  const [addMenu, setAddMenu] = useState<DOMRect | null>(null);
  const searchControl = useRef<((open: boolean) => void) | null>(null);

  const summaries = useMemo<ProjectSummary[]>(
    () =>
      projects
        .map((project) => {
          const inside = notes.filter((n) => n.projectId === project.id);
          return {
            project,
            count: inside.length,
            lastActive: Math.max(project.updatedAt, ...inside.map((n) => n.updatedAt)),
          };
        })
        .sort((a, b) => b.lastActive - a.lastActive),
    [projects, notes]
  );
  const standalone = useMemo<Note[]>(() => notes.filter((n) => !n.projectId), [notes]);

  const q = query.trim().toLowerCase();
  const foundProjects = q ? summaries.filter((s) => s.project.name.toLowerCase().includes(q)) : [];
  const foundNotes = q ? notes.filter((n) => matchesQuery(n, q)) : [];

  const empty = notes.length === 0 && projects.length === 0 && newProject === null;

  const submitProject = () => {
    const name = (newProject ?? "").trim();
    setNewProject(null);
    if (name) openProject(createProject(name));
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      {/* × · Notes / search · + */}
      <div className="shrink-0 bg-white px-3 pb-2 pt-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={closeNotes}
            aria-label="Close notes"
            title="Close"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          >
            <X size={19} />
          </button>
          <NotesSearch
            title="Notes"
            query={query}
            onQuery={setQuery}
            placeholder="Search notes and projects…"
            openRef={searchControl}
          />
          <button
            type="button"
            onClick={(e) => setAddMenu(e.currentTarget.getBoundingClientRect())}
            aria-label="New note or project"
            title="New"
            aria-haspopup="menu"
            aria-expanded={Boolean(addMenu)}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              addMenu ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800",
            ].join(" ")}
          >
            <Plus size={19} />
          </button>
        </div>

        {addMenu && (
          <DropdownMenu anchor={addMenu} onClose={() => setAddMenu(null)} label="Create" width={200}>
            <MenuRow
              icon={<FilePlus2 size={14} />}
              label="New note"
              onSelect={() => {
                setAddMenu(null);
                createNote(null);
              }}
            />
            <MenuRow
              icon={<FolderPlus size={14} />}
              label="New project"
              onSelect={() => {
                setAddMenu(null);
                searchControl.current?.(false);
                setQuery("");
                setNewProject("");
              }}
            />
          </DropdownMenu>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <StickyNote size={22} />
            </div>
            <p className="text-sm font-medium text-neutral-700">No notes yet</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Notes are shared across every window. Use{" "}
              <Plus size={12} className="-mt-0.5 inline" aria-label="plus" /> to create a note, or a project to
              group related notes.
            </p>
          </div>
        ) : q ? (
          foundProjects.length + foundNotes.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-400">Nothing matches “{query}”.</div>
          ) : (
            <div className="space-y-1 py-1">
              {foundProjects.map((s) => (
                <ProjectRow key={s.project.id} summary={s} onOpen={() => openProject(s.project.id)} />
              ))}
              {foundNotes.map((n) => (
                <NoteRow key={n.id} note={n} showProject />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-1 py-1">
            {newProject !== null && (
              <form
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitProject();
                }}
              >
                <ProjectIcon color="#a3a3a3" />
                <input
                  autoFocus
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  onBlur={submitProject}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setNewProject(null);
                    }
                  }}
                  placeholder="Project name, e.g. eMedicalls"
                  aria-label="New project name"
                  maxLength={80}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-800 outline-none placeholder:font-normal placeholder:text-neutral-400"
                />
              </form>
            )}
            {summaries.map((s) => (
              <ProjectRow key={s.project.id} summary={s} onOpen={() => openProject(s.project.id)} />
            ))}
            {standalone.map((n) => (
              <NoteRow key={n.id} note={n} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
