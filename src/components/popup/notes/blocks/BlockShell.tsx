import type { ReactNode } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Trash2,
} from "lucide-react";

import { useNotesStore } from "../../../../stores/notesStore";

type Props = {
  id: string;
  children: ReactNode;
  onCopy?: () => void;
  copied?: boolean;
  /** divider has no padded surface */
  bare?: boolean;
};

export default function BlockShell({
  id,
  children,
  onCopy,
  copied = false,
  bare = false,
}: Props) {
  const moveBlock = useNotesStore((s) => s.moveBlock);
  const deleteBlock = useNotesStore((s) => s.deleteBlock);

  const actionClass =
    "rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700";

  return (
    <div className="group/block relative">
      <div
        className={
          bare
            ? ""
            : "rounded-xl px-1 py-0.5 transition-colors group-hover/block:bg-neutral-50 group-focus-within/block:bg-transparent"
        }
      >
        {children}
      </div>

      {/*
        Floating toolbar: only on hover, and hidden while the block is being
        edited (focus-within). Opaque pill on the top edge so it never tangles
        with text or the block's own controls.
      */}
      <div
        className="pointer-events-none absolute right-1 top-0 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-0.5 opacity-0 shadow-sm transition-opacity duration-150 group-hover/block:pointer-events-auto group-hover/block:opacity-100 group-focus-within/block:!pointer-events-none group-focus-within/block:!opacity-0"
      >
        {onCopy && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCopy}
            aria-label="Copy"
            className={actionClass}
          >
            {copied ? (
              <Check size={14} className="text-emerald-500" />
            ) : (
              <Copy size={14} />
            )}
          </button>
        )}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => moveBlock(id, -1)}
          aria-label="Move up"
          className={actionClass}
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => moveBlock(id, 1)}
          aria-label="Move down"
          className={actionClass}
        >
          <ChevronDown size={14} />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => deleteBlock(id)}
          aria-label="Delete block"
          className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
