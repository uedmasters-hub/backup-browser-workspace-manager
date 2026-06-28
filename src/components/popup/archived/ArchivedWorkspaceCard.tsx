import {
  RotateCcw,
  Trash2,
} from "lucide-react";

import type { WorkspaceWindow } from "../../../types/window";

type Props = {
  window: WorkspaceWindow;

  onRestore: () => void;

  onDelete: () => void;
};

export default function ArchivedWorkspaceCard({
  window,
  onRestore,
  onDelete,
}: Props) {
  return (
    <div
      className="
        group
        flex
        items-center
        justify-between
        rounded-2xl
        border
        border-neutral-200
        bg-white
        px-4
        py-3
        transition-all
        duration-200
        hover:border-neutral-300
        hover:shadow-sm
      "
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-xl">
          {window.emoji ?? "📁"}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-neutral-900">
            {window.name}
          </h3>

          <p className="text-xs text-neutral-500">
            {window.tabCount} tabs
          </p>
        </div>
      </div>

      <div
        className="
          flex
          items-center
          gap-1
          opacity-0
          transition-opacity
          group-hover:opacity-100
        "
      >
        <button
          type="button"
          onClick={onRestore}
          className="rounded-lg p-2 hover:bg-neutral-100"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}