import { useState } from "react";
import { Check, FolderPlus, StickyNote } from "lucide-react";

import DropdownMenu, { MenuCaption, MenuDivider, MenuRow } from "../menus/DropdownMenu";
import ProjectIcon from "./ProjectIcon";
import { useNotesStore } from "../../../../stores/notesStore";

/** "Move to" picker: no project (standalone), any project, or a new one. */
export default function MoveToProjectMenu({
  noteId,
  anchor,
  onClose,
}: {
  noteId: string;
  anchor: DOMRect;
  onClose: () => void;
}) {
  const projects = useNotesStore((s) => s.projects);
  const current = useNotesStore((s) => s.notes.find((n) => n.id === noteId)?.projectId ?? null);
  const moveNote = useNotesStore((s) => s.moveNote);
  const createProject = useNotesStore((s) => s.createProject);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  const pick = (projectId: string | null) => {
    moveNote(noteId, projectId);
    onClose();
  };

  const check = <Check size={15} className="shrink-0 text-indigo-600" />;

  return (
    <DropdownMenu anchor={anchor} onClose={onClose} label="Move to project">
      <MenuCaption>Move to</MenuCaption>

      <MenuRow
        role="menuitemradio"
        checked={current === null}
        icon={<StickyNote size={14} />}
        label="No project"
        trailing={current === null && check}
        onSelect={() => pick(null)}
      />

      {projects.length > 0 && (
        <div className="max-h-[220px] overflow-y-auto overscroll-contain">
          {projects.map((p) => (
            <MenuRow
              key={p.id}
              role="menuitemradio"
              checked={current === p.id}
              icon={<ProjectIcon color={p.color} size={28} />}
              label={p.name}
              trailing={current === p.id && check}
              onSelect={() => pick(p.id)}
            />
          ))}
        </div>
      )}

      <MenuDivider />
      {creating ? (
        <form
          className="flex items-center gap-1.5 px-1 py-1"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) pick(createProject(trimmed));
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            aria-label="New project name"
            maxLength={80}
            className="h-8 min-w-0 flex-1 rounded-lg bg-neutral-50 px-2.5 text-sm text-neutral-800 outline-none ring-1 ring-neutral-200 placeholder:text-neutral-400 focus:ring-indigo-300"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="h-8 shrink-0 rounded-lg bg-neutral-900 px-2.5 text-xs font-medium text-white disabled:opacity-30"
          >
            Move
          </button>
        </form>
      ) : (
        <MenuRow icon={<FolderPlus size={14} />} label="New project…" onSelect={() => setCreating(true)} />
      )}
    </DropdownMenu>
  );
}
