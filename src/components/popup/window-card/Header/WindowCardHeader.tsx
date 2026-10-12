import type { MouseEvent } from "react";

import {
  MoreVertical,
  VenetianMask,
} from "lucide-react";

import { PRIVATE_LABEL } from "../../../../browser/services/incognitoService";

import RenameInput from "./RenameInput";

type Props = {
  title: string;

  emoji?: string;

  incognito?: boolean;

  renaming: boolean;

  saving: boolean;

  isMenuOpen: boolean;

  onTitleChange: (
    value: string
  ) => void;

  onRenameSave: () => void | Promise<void>;

  onRenameCancel: () => void;

  onStartRename: () => void;

  onMenu: (
    e: MouseEvent<HTMLButtonElement>
  ) => void;
};

export default function WindowCardHeader({
  title,
  emoji,
  incognito = false,
  renaming,
  saving,
  isMenuOpen,
  onTitleChange,
  onRenameSave,
  onRenameCancel,
  onStartRename,
  onMenu,
}: Props) {
  return (
    <div className="flex items-start justify-between">
      <div
        className="min-w-0 flex-1"
        onDoubleClick={(e) => {
          e.stopPropagation();
          onStartRename();
        }}
      >
        <div
          className={[
            "flex items-center",
            incognito ? "gap-1.5" : "gap-2",
          ].join(" ")}
        >
          {incognito && (
            <span
              title={`${PRIVATE_LABEL.window} window`}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white"
            >
              <VenetianMask size={12} strokeWidth={2.5} />
              <span className="sr-only">{PRIVATE_LABEL.window} window</span>
            </span>
          )}

          {emoji && (
            <span className="text-lg leading-none">
              {emoji}
            </span>
          )}

          {renaming ? (
            <RenameInput
              value={title}
              disabled={saving}
              onChange={onTitleChange}
              onSave={onRenameSave}
              onCancel={onRenameCancel}
            />
          ) : (
            <h3 className="truncate text-base font-medium text-neutral-800">
              {title}
            </h3>
          )}
        </div>
      </div>

      <div className="ml-3 flex items-center gap-1">
        <button
          type="button"
          onClick={onMenu}
          className={[
            "rounded-lg p-1 transition",
            isMenuOpen
              ? "bg-black/10"
              : "hover:bg-black/5",
          ].join(" ")}
        >
          <MoreVertical
            size={18}
          />
        </button>
      </div>
    </div>
  );
}
