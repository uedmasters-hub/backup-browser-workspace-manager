import { useEffect } from "react";

import WindowGrid from "./windows/WindowGrid";
import ArchivedSection from "./ArchivedSection";
import UntitledSection from "./UntitledSection";

import { useWindowStore } from "../../stores/windowStore";
import { useTabStore } from "../../stores/tabStore";

import {
  getActiveWorkspaces,
  getArchivedWorkspaces,
} from "../../stores/selectors/workspaceSelectors";

export default function WindowSection() {
  const windows = useWindowStore((state) => state.windows);

  const refreshWindows = useWindowStore(
    (state) => state.refreshWindows
  );

  const selectWindow = useWindowStore(
    (state) => state.selectWindow
  );

  const restoreWorkspace = useWindowStore(
    (state) => state.restoreWorkspace
  );

  const deleteWorkspaceMetadata = useWindowStore(
    (state) => state.deleteWorkspaceMetadata
  );

  const loadTabs = useTabStore((state) => state.loadTabs);

  useEffect(() => {
    async function load() {
      await refreshWindows();

      const updatedWindows =
        useWindowStore.getState().windows;

      const firstWindow =
        getActiveWorkspaces(updatedWindows)[0]?.chromeWindowId;

      if (!firstWindow) {
        return;
      }

      await selectWindow(firstWindow);
      await loadTabs(firstWindow);
    }

    load();
  }, [refreshWindows, selectWindow, loadTabs]);

  const activeWindows = getActiveWorkspaces(windows);
  const archivedWindows = getArchivedWorkspaces(windows);

  return (
    <>
      <WindowGrid windows={activeWindows} />

      <ArchivedSection
        windows={archivedWindows}
        onRestore={(chromeWindowId) =>
          restoreWorkspace(chromeWindowId)
        }
        onDelete={(chromeWindowId) =>
          deleteWorkspaceMetadata(chromeWindowId)
        }
      />

      <UntitledSection />
    </>
  );
}
