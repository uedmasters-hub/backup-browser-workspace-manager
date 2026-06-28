import { useWindowStore } from "../../../stores/windowStore";

import {
  useRenameState,
} from "./State";

import {
  useWindowCardHandlers,
} from "./Handlers";

import WindowCardHeader from "./Header/WindowCardHeader";
import WindowCardFooter from "./Footer/WindowCardFooter";

import WorkspaceMenu from "../menus/WorkspaceMenu";

import type { WorkspaceWindow } from "../../../types/window";

type Props = {
  window: WorkspaceWindow;
};

export default function WindowCard({
  window,
}: Props) {
  const renameWorkspace =
    useWindowStore(
      (state) =>
        state.renameWorkspace
    );

  const selectedWindowId =
    useWindowStore(
      (state) =>
        state.selectedWindowId
    );

  const handlers =
    useWindowCardHandlers({
      chromeWindowId:
        window.chromeWindowId,
    });

  const rename =
    useRenameState({
      initialValue:
        window.name,

      onSave: async (value) => {
        if (
          !window.chromeWindowId
        ) {
          return;
        }

        await renameWorkspace(
          window.chromeWindowId,
          value
        );
      },
    });

  const isSelected =
    selectedWindowId ===
    window.chromeWindowId;

  return (
    <>
      <div
        onClick={
          handlers.handleSelect
        }
        className={[
          "relative h-[128px] cursor-pointer rounded-[24px] px-4 py-5 transition-all duration-200",

          isSelected
            ? "shadow-lg ring-1 ring-black/10"
            : "hover:shadow-md",
        ].join(" ")}
        style={{
          backgroundColor:
            window.color,
        }}
      >
        {isSelected && (
          <div className="absolute left-0 top-6 h-12 w-1 rounded-r-full bg-neutral-900" />
        )}

        <WindowCardHeader
          title={rename.value}
          emoji={window.emoji}
          renaming={rename.editing}
          saving={rename.saving}
          isMenuOpen={handlers.isMenuOpen}
          onTitleChange={rename.setValue}
          onRenameSave={rename.save}
          onRenameCancel={rename.cancel}
          onStartRename={rename.start}
          onMenu={handlers.handleMenu}
        />

        <WindowCardFooter
          tabCount={
            window.tabCount
          }
          onFocus={
            handlers.handleFocus
          }
        />
      </div>

      <WorkspaceMenu
        open={
          handlers.isMenuOpen
        }
        onClose={
          handlers.closeMenu
        }
        chromeWindowId={
          window.chromeWindowId!
        }
        workspaceName={
          window.name
        }
        onRename={
          rename.start
        }
        onArchive={
          handlers.handleArchive
        }
        onDelete={
          handlers.handleDelete
        }
      />
    </>
  );
}
