import { useMemo, useState } from "react";
import { ChevronRight, Folder, FolderPlus, Plus, Search, StickyNote, X } from "lucide-react";

import { useUIStore } from "../../../stores/uiStore";
import { useNotesStore } from "../../../stores/notesStore";

import NoteRow from "./NoteRow";
import ProjectIcon from "./projects/ProjectIcon";
import { ago, matchesQuery } from "./noteMeta";

import type { Note, NoteProject } from "../../../types/notes";

type ProjectSummary = { project: NoteProject; count: number; lastActive: number };

function SectionLabel({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="mb-1 mt-3 flex items-center gap-2 px-1 first:mt-1">
      {icon}
      <span className="text-xs font-medium text-neutral-500">
        {label}
        {count > 0 ? ` · ${count}` : ""}
      </span>
    </div>
  );
}

function ProjectRow({ summary, onOpen }: { summary: ProjectSummary; onOpen: () => void }) {
  const { project, count, lastActive } = summary;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-50"
    >
      <ProjectIcon color={project.color} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-neutral-800">{project.name}</span>
        <span className="block truncate text-xs text-neutral-400">
          {count === 0 ? "No notes yet" : `${count} note${count === 1 ? "" : "s"}`} · {ago(lastActive)}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-neutral-300" />
    </button>
  );
}

/** All notes: projects first, then standalone notes. Search looks everywhere. */
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
              placeholder="Search notes and projects…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-300"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-2">
        {empty ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-400">
              <StickyNote size={22} />
            </div>
            <p className="text-sm font-medium text-neutral-700">No notes yet</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Notes are shared across every window. Create a note, or a project to group related notes.
            </p>
          </div>
        ) : q ? (
          foundProjects.length + foundNotes.length === 0 ? (
            <div className="py-16 text-center text-sm text-neutral-400">Nothing matches “{query}”.</div>
          ) : (
            <div className="py-1">
              {foundProjects.length > 0 && (
                <>
                  <SectionLabel icon={<Folder size={13} className="text-neutral-400" />} label="Projects" count={foundProjects.length} />
                  <div className="space-y-1">
                    {foundProjects.map((s) => (
                      <ProjectRow key={s.project.id} summary={s} onOpen={() => openProject(s.project.id)} />
                    ))}
                  </div>
                </>
              )}
              {foundNotes.length > 0 && (
                <>
                  <SectionLabel icon={<StickyNote size={13} className="text-neutral-400" />} label="Notes" count={foundNotes.length} />
                  <div className="space-y-1.5">
                    {foundNotes.map((n) => (
                      <NoteRow key={n.id} note={n} showProject />
                    ))}
                  </div>
                </>
              )}
            </div>
          )
        ) : (
          <div className="py-1">
            {(summaries.length > 0 || newProject !== null) && (
              <>
                <SectionLabel icon={<Folder size={13} className="text-neutral-400" />} label="Projects" count={summaries.length} />
                <div className="space-y-1">
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
                </div>
              </>
            )}

            <SectionLabel icon={<StickyNote size={13} className="text-neutral-400" />} label="Notes" count={standalone.length} />
            {standalone.length === 0 ? (
              <p className="px-1 py-3 text-xs text-neutral-400">
                No standalone notes — every note is in a project.
              </p>
            ) : (
              <div className="space-y-1.5">
                {standalone.map((n) => (
                  <NoteRow key={n.id} note={n} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2 border-t border-neutral-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => createNote(null)}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus size={16} /> New note
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setNewProject("");
          }}
          title="New project"
          aria-label="New project"
          className="flex items-center justify-center gap-2 rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
        >
          <FolderPlus size={16} /> Project
        </button>
      </div>
    </div>
  );
}
