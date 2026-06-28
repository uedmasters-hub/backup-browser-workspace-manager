import type { WorkspaceWindow } from "../../../../types/window";

type Props = {
  window: WorkspaceWindow;

  onRename: () => void;
  onColor: () => void;
  onEmoji: () => void;
  onArchive: () => void;
  onDelete: () => void;

  onClose: () => void;
};

export default function useWorkspaceMenu({
  window,
  onRename,
  onColor,
  onEmoji,
  onArchive,
  onDelete,
  onClose,
}: Props) {
  function handleRename() {
    onRename();
    onClose();
  }

  function handleColor() {
    onColor();
    onClose();
  }

  function handleEmoji() {
    onEmoji();
    onClose();
  }

  function handleArchive() {
    onArchive();
    onClose();
  }

  function handleDelete() {
    onDelete();
    onClose();
  }

  return {
    workspaceName: window.name,

    handleRename,

    handleColor,

    handleEmoji,

    handleArchive,

    handleDelete,
  };
}
