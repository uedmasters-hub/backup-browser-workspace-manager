import { useMemo, useState } from "react";

import {
  BaseDialog,
  DialogFooter,
  DialogHeader,
  DialogItem,
  DialogList,
  DialogSearch,
} from ".";

import { useWindowStore } from "../../../stores/windowStore";
import { useTabStore } from "../../../stores/tabStore";

import { useUIStore } from "../../../stores/uiStore";

export default function MoveTabsDialog() {
  {
    const [query, setQuery] = useState("");

    const activeDialog = useUIStore(
      (state) => state.activeDialog
    );

    const closeDialog = useUIStore(
      (state) => state.closeDialog
    );

    const windows = useWindowStore(
      (state) => state.windows
    );

    const selectedWindowId = useWindowStore(
      (state) => state.selectedWindowId
    );

    const moveSelectedTabs = useTabStore(
      (state) => state.moveSelectedTabs
    );

    const workspaces = useMemo(() => {
      const search = query.toLowerCase();

      return windows.filter((window) => {
        if (
          window.chromeWindowId ===
          selectedWindowId
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        return window.name
          .toLowerCase()
          .includes(search);
      });
    }, [
      windows,
      selectedWindowId,
      query,
    ]);

    async function handleMove(
      targetWindowId: number
    ) {
      await moveSelectedTabs(
        targetWindowId
      );

      setQuery("");

      closeDialog();
    }

    return (
      <BaseDialog
        open={
          activeDialog === "move-tabs"
        }
        onClose={closeDialog}
      >
        <DialogHeader
          title="Move Tabs"
          subtitle="Choose a workspace"
          onClose={closeDialog}
        />

        <DialogSearch
          value={query}
          onChange={setQuery}
          placeholder="Search workspaces..."
          autoFocus
        />

        <DialogList
          isEmpty={
            workspaces.length === 0
          }
        >
          {workspaces.map(
            (workspace) => (
              <DialogItem
                key={
                  workspace.chromeWindowId
                }
                title={workspace.name}
                subtitle={`${workspace.tabCount} tabs`}
                leading={
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      background:
                        workspace.color,
                    }}
                  />
                }
                onClick={() =>
                  handleMove(
                    workspace.chromeWindowId!
                  )
                }
              />
            )
          )}
        </DialogList>

        <DialogFooter
          left={
            <>
              <span>Esc Close</span>
              <span>•</span>
              <span>Select Workspace</span>
            </>
          }
        />
      </BaseDialog>
    );
  }
}