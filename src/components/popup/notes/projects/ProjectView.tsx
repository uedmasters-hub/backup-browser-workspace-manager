import { useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Download,
  FileText,
  Lock,
  LockOpen,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import NoteRow from "../NoteRow";
import PinPrompt from "../PinPrompt";
import LockGate from "../LockGate";
import ProjectIcon from "./ProjectIcon";
import DropdownMenu, { MenuCaption, MenuDivider, MenuRow } from "../menus/DropdownMenu";
import { PROJECT_COLORS, useNotesStore } from "../../../../stores/notesStore";

import type { NoteProject } from "../../../../types/notes";

const COLOR_NAMES: Record<string, string> = {
  "#6366F1": "Indigo",
  "#0EA5E9": "Sky",
  "#10B981": "Emerald",
  "#F59E0B": "Amber",
  "#EC4899": "Pink",
  "#8B5CF6": "Violet",
  "#EF4444": "Red",
  "#14B8A6": "Teal",
};

/** A project: its notes, or — while locked — the PIN screen. */
export default function ProjectView({ project }: { project: NoteProject }) {
  const open = useNotesStore((s) => s.unlockedProjectIds.includes(project.id));
  const openProject = useNotesStore((s) => s.openProject);
  const unlockProject = useNotesStore((s) => s.unlockProject);

  if (project.locked && !open) {
    return (
      <LockGate
        title={project.name}
        badge={<ProjectIcon color={project.color} size={24} />}
        subtitle="This project is encrypted. Enter your PIN to open its notes."
        backLabel="Back to all notes"
        onBack={() => openProject(undefined)}
        onUnlock={(pin) => unlockProject(project.id, pin)}
      />
    );
  }
  return <OpenProject project={project} />;
}

function OpenProject({ project }: { project: NoteProject }) {
  const openProject = useNotesStore((s) => s.openProject);
  const renameProject = useNotesStore((s) => s.renameProject);
  const deleteProject = useNotesStore((s) => s.deleteProject);
  const setProjectColor = useNotesStore((s) => s.setProjectColor);
  const lockProject = useNotesStore((s) => s.lockProject);
  const relockProject = useNotesStore((s) => s.relockProject);
  const removeProjectLock = useNotesStore((s) => s.removeProjectLock);
  const createNote = useNotesStore((s) => s.createNote);
  const allNotes = useNotesStore((s) => s.notes);
  const notes = allNotes.filter((n) => n.projectId === project.id);

  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(project.name);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [panel, setPanel] = useState<null | "lock" | "delete">(null);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(project.name);
      return;
    }
    if (trimmed !== project.name) renameProject(project.id, trimmed);
  };

  const closeMenu = () => setMenu(null);
  const download = () =>
    // Export code loads on demand — it's only needed for downloads.
    void import("../projectExport").then(({ downloadProject }) =>
      downloadProject({ ...project, name: name.trim() || project.name }, notes)
    );

  const count = notes.length;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="sticky top-0 z-10 shrink-0 bg-white px-3 pb-2 pt-4">
        {/* back · icon · name · ⋮ */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => openProject(undefined)}
            aria-label="Back to all notes"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100"
          >
            <ChevronLeft size={20} />
          </button>
          <ProjectIcon color={project.color} size={30} locked={project.locked} />
          <input
            ref={nameRef}
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
            onClick={() => createNote(project.id)}
            aria-label={`New note in ${project.name}`}
            title="New note"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800"
          >
            <Plus size={19} />
          </button>
          <button
            type="button"
            onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}
            aria-label="Project actions"
            title="Project actions"
            aria-haspopup="menu"
            aria-expanded={Boolean(menu)}
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              menu ? "bg-neutral-100 text-neutral-800" : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700",
            ].join(" ")}
          >
            <MoreVertical size={17} />
          </button>
        </div>

        {menu && (
          <DropdownMenu anchor={menu} onClose={closeMenu} label="Project actions" width={232}>
            <MenuRow
              icon={<Pencil size={14} />}
              label="Rename"
              onSelect={() => {
                closeMenu();
                requestAnimationFrame(() => nameRef.current?.select());
              }}
            />
            <MenuCaption>Colour</MenuCaption>
            <div className="grid grid-cols-8 gap-1 px-2.5 pb-2 pt-0.5">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="menuitemradio"
                  aria-checked={project.color === c}
                  aria-label={COLOR_NAMES[c] ?? c}
                  title={COLOR_NAMES[c]}
                  onClick={() => setProjectColor(project.id, c)}
                  className="flex aspect-square items-center justify-center rounded-full outline-none ring-offset-2 transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-neutral-900"
                  style={{ backgroundColor: c }}
                >
                  {project.color === c && <Check size={11} strokeWidth={3.2} className="text-white" />}
                </button>
              ))}
            </div>
            <MenuDivider />
            {project.locked ? (
              <>
                <MenuRow
                  icon={<Lock size={14} />}
                  tone="warning"
                  label="Lock now"
                  onSelect={() => {
                    closeMenu();
                    void relockProject(project.id);
                  }}
                />
                <MenuRow
                  icon={<LockOpen size={14} />}
                  label="Remove lock"
                  onSelect={() => {
                    closeMenu();
                    removeProjectLock(project.id);
                  }}
                />
              </>
            ) : (
              <MenuRow
                icon={<Lock size={14} />}
                label="Lock project"
                onSelect={() => {
                  closeMenu();
                  setPanel("lock");
                }}
              />
            )}
            <MenuRow
              icon={<Download size={14} />}
              label="Download as ZIP"
              onSelect={() => {
                closeMenu();
                download();
              }}
            />
            <MenuDivider />
            <MenuRow
              icon={<Trash2 size={14} />}
              tone="danger"
              label="Delete project"
              onSelect={() => {
                closeMenu();
                setPanel("delete");
              }}
            />
          </DropdownMenu>
        )}

        {panel === "lock" && (
          <div className="mx-1 mt-2">
            <PinPrompt
              title="Set a PIN to lock this project"
              confirmLabel="Lock"
              onCancel={() => setPanel(null)}
              onSubmit={async (pin) => {
                await lockProject(project.id, pin);
                setPanel(null);
                return true;
              }}
            />
            <p className="mt-1.5 px-1 text-[11px] leading-relaxed text-neutral-400">
              Every note in it is encrypted, titles included. Without the PIN they can't be recovered.
            </p>
          </div>
        )}

        {panel === "delete" && (
          <div role="alertdialog" aria-label="Delete project" className="mx-1 mt-2 rounded-2xl border border-red-100 bg-red-50/60 p-3">
            <p className="text-sm font-medium text-neutral-800">Delete “{project.name}”?</p>
            <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
              {count === 0
                ? "The project is empty."
                : `${count === 1 ? "Its note won't be deleted — it'll" : `Its ${count} notes won't be deleted — they'll`} move to Notes${project.locked ? " and won't be locked anymore" : ""}.`}
            </p>
            <div className="mt-2.5 flex justify-end gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPanel(null)}
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
            {count === 0 ? "No notes yet" : `${count} note${count === 1 ? "" : "s"}`}
          </span>
          {project.locked && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
              <Lock size={10} strokeWidth={2.6} /> Locks when you leave
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-3 pt-1">
        {count === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-8 text-center">
            <ProjectIcon color={project.color} size={48} locked={project.locked} />
            <p className="mt-3 text-sm font-medium text-neutral-700">Nothing in {project.name} yet</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">
              Use <Plus size={12} className="-mt-0.5 inline" aria-label="plus" /> to add a note, or bring
              existing notes here with the move button on any note.
            </p>
          </div>
        ) : (
          <div className="space-y-1 py-1">
            {notes.map((n) => (
              <NoteRow key={n.id} note={n} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
