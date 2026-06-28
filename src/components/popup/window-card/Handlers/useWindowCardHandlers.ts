import type { MouseEvent } from "react";

import { useTabStore } from "../../../../stores/tabStore";
import { useUIStore } from "../../../../stores/uiStore";
import { useWindowStore } from "../../../../stores/windowStore";

type Props = {
  chromeWindowId?: number;
};

export default function useWindowCardHandlers({
  chromeWindowId,
}: Props) {
  const loadTabs = useTabStore(
    (state) => state.loadTabs
  );

  const selectWindow = useWindowStore(
    (state) => state.selectWindow
  );

  const focusWindow = useWindowStore(
    (state) => state.focusWindow
  );

  const archiveWorkspace =
    useWindowStore(
      (state) => state.archiveWorkspace
    );

  const deleteWorkspaceMetadata =
    useWindowStore(
      (state) =>
        state.deleteWorkspaceMetadata
    );

  const activeWorkspaceMenu =
    useUIStore(
      (state) =>
        state.activeWorkspaceMenu
    );

  const openWorkspaceMenu =
    useUIStore(
      (state) =>
        state.openWorkspaceMenu
    );

  const closeWorkspaceMenu =
    useUIStore(
      (state) =>
        state.closeWorkspaceMenu
    );

  const isMenuOpen =
    activeWorkspaceMenu ===
    chromeWindowId;

  async function handleSelect() {
    if (!chromeWindowId) {
      return;
    }

    await selectWindow(
      chromeWindowId
    );

    await loadTabs(
      chromeWindowId
    );
  }

  async function handleFocus(
    e: MouseEvent<HTMLButtonElement>
  ) {
    e.stopPropagation();

    if (!chromeWindowId) {
      return;
    }

    await focusWindow(
      chromeWindowId
    );
  }

  async function handleArchive() {
    if (!chromeWindowId) {
      return;
    }

    closeWorkspaceMenu();

    await archiveWorkspace(
      chromeWindowId
    );
  }

  async function handleDelete() {
    if (!chromeWindowId) {
      return;
    }

    closeWorkspaceMenu();

    await deleteWorkspaceMetadata(
      chromeWindowId
    );
  }

  function handleMenu(
    e: MouseEvent<HTMLButtonElement>
  ) {
    e.stopPropagation();

    if (!chromeWindowId) {
      return;
    }

    if (isMenuOpen) {
      closeWorkspaceMenu();
      return;
    }

    openWorkspaceMenu(
      chromeWindowId
    );
  }

  return {
    isMenuOpen,

    handleSelect,

    handleFocus,

    handleArchive,

    handleDelete,

    handleMenu,

    closeMenu:
      closeWorkspaceMenu,
  };
}
