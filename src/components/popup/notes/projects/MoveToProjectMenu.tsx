import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, FolderPlus, StickyNote } from "lucide-react";

import Portal from "../../menus/Portal";
import ProjectIcon from "./ProjectIcon";
import { useNotesStore } from "../../../../stores/notesStore";

const WIDTH = 248;
const EDGE = 8;

/**
 * "Move to" picker: no project (standalone), any project, or a new one.
 * Anchored under the button that opened it; flips up when there's no room.
 */
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

  const ref = useRef<HTMLDivElement>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const h = el.offsetHeight;
    const left = Math.min(Math.max(EDGE, anchor.right - WIDTH), window.innerWidth - WIDTH - EDGE);
    const below = anchor.bottom + 6;
    const top = below + h <= window.innerHeight - EDGE ? below : Math.max(EDGE, anchor.top - 6 - h);
    setPos({ top, left });
  }, [anchor, creating, projects.length]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const pick = (projectId: string | null) => {
    moveNote(noteId, projectId);
    onClose();
  };

  const createAndMove = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    pick(createProject(trimmed));
  };

  const item =
    "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-neutral-800 outline-none transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100";

  return (
    <Portal>
      <div
        ref={ref}
        role="menu"
        aria-label="Move to project"
        style={{
          position: "fixed",
          top: pos?.top ?? anchor.bottom + 6,
          left: pos?.left ?? anchor.left,
          width: WIDTH,
          zIndex: 9999,
          visibility: pos ? "visible" : "hidden",
        }}
        className="rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-2xl"
      >
        <p className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-neutral-400">Move to</p>

        <button type="button" role="menuitemradio" aria-checked={current === null} onClick={() => pick(null)} className={item}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500">
            <StickyNote size={14} />
          </span>
          <span className="min-w-0 flex-1 truncate">No project</span>
          {current === null && <Check size={15} className="shrink-0 text-indigo-600" />}
        </button>

        {projects.length > 0 && (
          <div className="max-h-[220px] overflow-y-auto overscroll-contain">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitemradio"
                aria-checked={current === p.id}
                onClick={() => pick(p.id)}
                className={item}
              >
                <ProjectIcon color={p.color} size={28} />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {current === p.id && <Check size={15} className="shrink-0 text-indigo-600" />}
              </button>
            ))}
          </div>
        )}

        <div className="mt-1 border-t border-neutral-100 pt-1">
          {creating ? (
            <form
              className="flex items-center gap-1.5 px-1 py-1"
              onSubmit={(e) => {
                e.preventDefault();
                createAndMove();
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
            <button type="button" role="menuitem" onClick={() => setCreating(true)} className={item}>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-neutral-500">
                <FolderPlus size={14} />
              </span>
              New project…
            </button>
          )}
        </div>
      </div>
    </Portal>
  );
}
