import {
  Archive,
  Palette,
  Pencil,
  Smile,
  Trash2,
} from "lucide-react";

import { BaseMenu, MenuItem } from ".";

import { useUIStore } from "../../../stores/uiStore";

type Props = {
  open: boolean;
  onClose: () => void;

  chromeWindowId: number;

  workspaceName: string;

  onRename: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

export default function WorkspaceMenu({
  open,
  onClose,
  chromeWindowId,
  workspaceName,
  onRename,
  onArchive,
  onDelete,
}: Props) {
  const openColorPicker =
    useUIStore(
      (state) =>
        state.openColorPicker
    );

  const openEmojiPicker =
    useUIStore(
      (state) =>
        state.openEmojiPicker
    );

  return (
    <BaseMenu
      open={open}
      onClose={onClose}
    >
      <div className="border-b border-neutral-100 px-4 py-3">
        <p className="truncate text-sm font-semibold text-neutral-900">
          {workspaceName}
        </p>
      </div>

      <MenuItem
        icon={<Pencil size={16} />}
        label="Rename"
        onClick={() => {
          onClose();
          onRename();
        }}
      />

      <MenuItem
        icon={<Palette size={16} />}
        label="Color"
        hasSubmenu
        onClick={() => {
          onClose();
          openColorPicker(
            chromeWindowId
          );
        }}
      />

      <MenuItem
        icon={<Smile size={16} />}
        label="Emoji"
        hasSubmenu
        onClick={() => {
          onClose();
          openEmojiPicker(
            chromeWindowId
          );
        }}
      />

      <MenuItem
        icon={<Archive size={16} />}
        label="Archive"
        onClick={() => {
          onClose();
          onArchive();
        }}
      />

      <div className="my-1 border-t border-neutral-100" />

      <MenuItem
        icon={<Trash2 size={16} />}
        label="Delete Metadata"
        danger
        onClick={() => {
          onClose();
          onDelete();
        }}
      />
    </BaseMenu>
  );
}
