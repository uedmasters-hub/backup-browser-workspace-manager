import { create } from "zustand";

import type { WorkspaceWindow } from "../types/window";
import type { WorkspaceMetadata } from "../types/workspace";

import {
  getAllWindows,
  focusWindow as focusChromeWindow,
} from "../browser/services/windowService";

import { mapChromeWindow } from "../browser/services/windowMapper";

import {
  getWorkspace,
  getWorkspaces,
  upsertWorkspace,
  removeWorkspace,
} from "../browser/storage/workspaceRepository";

interface WindowState {
  windows: WorkspaceWindow[];
  selectedWindowId?: number;
}

interface WindowActions {
  setWindows: (
    windows: WorkspaceWindow[]
  ) => void;

  refreshWindows: () => Promise<void>;

  deleteWorkspaceMetadata: (
    chromeWindowId: number
  ) => Promise<void>;

  selectWindow: (
    chromeWindowId: number
  ) => Promise<void>;

  focusWindow: (
    chromeWindowId: number
  ) => Promise<void>;

  renameWorkspace: (
    chromeWindowId: number,
    name: string
  ) => Promise<void>;

  updateWorkspaceColor: (
    chromeWindowId: number,
    color: string
  ) => Promise<void>;

  updateWorkspaceEmoji: (
    chromeWindowId: number,
    emoji: string
  ) => Promise<void>;

  archiveWorkspace: (
    chromeWindowId: number
  ) => Promise<void>;

  restoreWorkspace: (
    chromeWindowId: number
  ) => Promise<void>;

  updateWindow: (
    id: number,
    updates: Partial<WorkspaceWindow>
  ) => void;
}

type WindowStore =
  WindowState &
  WindowActions;

export const useWindowStore =
  create<WindowStore>((set, get) => {
    async function saveWorkspace(
      workspace: WorkspaceMetadata
    ) {
      await upsertWorkspace(workspace);
      await get().refreshWindows();
    }

    async function getWorkspaceData(
      chromeWindowId: number
    ) {
      const existing =
        await getWorkspace(chromeWindowId);

      const now =
        new Date().toISOString();

      return {
        existing,
        now,
      };
    }

    function buildWorkspace(
      chromeWindowId: number,
      existing: WorkspaceMetadata | undefined,
      now: string,
      updates: Partial<WorkspaceMetadata>
    ): WorkspaceMetadata {
      return {
        chromeWindowId,

        name:
          updates.name ??
          existing?.name,

        color:
          updates.color ??
          existing?.color,

        emoji:
          updates.emoji ??
          existing?.emoji,

        archived:
          updates.archived ??
          existing?.archived ??
          false,

        createdAt:
          existing?.createdAt ??
          now,

        updatedAt: now,
      };
    }

    return {
      windows: [],

      selectedWindowId:
        undefined,

      setWindows: (windows) =>
        set({ windows }),

      refreshWindows:
        async () => {
          const chromeWindows =
            await getAllWindows();

          const metadata =
            await getWorkspaces();

          const windows = chromeWindows.map(
            (
              chromeWindow,
              index
            ) => {
              const workspace =
                metadata.find(
                  (item) =>
                    item.chromeWindowId ===
                    chromeWindow.id
                );

              return mapChromeWindow(
                chromeWindow,
                index,
                workspace
              );
            }
          );

          set({ windows });
        },

      selectWindow:
        async (
          chromeWindowId
        ) => {
          set({
            selectedWindowId:
              chromeWindowId,
          });
        },

      focusWindow:
        async (
          chromeWindowId
        ) => {
          await focusChromeWindow(
            chromeWindowId
          );

          await get().selectWindow(
            chromeWindowId
          );

          await get().refreshWindows();
        },

      renameWorkspace:
        async (
          chromeWindowId,
          name
        ) => {
          const {
            existing,
            now,
          } =
            await getWorkspaceData(
              chromeWindowId
            );

          await saveWorkspace(
            buildWorkspace(
              chromeWindowId,
              existing,
              now,
              {
                name,
              }
            )
          );
        },

      updateWorkspaceColor:
        async (
          chromeWindowId,
          color
        ) => {
          set((state) => ({
            windows:
              state.windows.map(
                (window) =>
                  window.chromeWindowId ===
                    chromeWindowId
                    ? {
                      ...window,
                      color,
                    }
                    : window
              ),
          }));

          const {
            existing,
            now,
          } =
            await getWorkspaceData(
              chromeWindowId
            );

          await saveWorkspace(
            buildWorkspace(
              chromeWindowId,
              existing,
              now,
              {
                color,
              }
            )
          );
        },

      updateWorkspaceEmoji:
        async (
          chromeWindowId,
          emoji
        ) => {
          set((state) => ({
            windows:
              state.windows.map(
                (window) =>
                  window.chromeWindowId ===
                    chromeWindowId
                    ? {
                      ...window,
                      emoji,
                    }
                    : window
              ),
          }));

          const {
            existing,
            now,
          } =
            await getWorkspaceData(
              chromeWindowId
            );

          await saveWorkspace(
            buildWorkspace(
              chromeWindowId,
              existing,
              now,
              {
                emoji,
              }
            )
          );
        },

      archiveWorkspace:
        async (
          chromeWindowId
        ) => {
          set((state) => ({
            windows:
              state.windows.map(
                (window) =>
                  window.chromeWindowId ===
                    chromeWindowId
                    ? {
                      ...window,
                      isArchived: true,
                    }
                    : window
              ),
          }));

          const {
            existing,
            now,
          } =
            await getWorkspaceData(
              chromeWindowId
            );

          await saveWorkspace(
            buildWorkspace(
              chromeWindowId,
              existing,
              now,
              {
                archived: true,
              }
            )
          );
        },

      restoreWorkspace:
        async (
          chromeWindowId
        ) => {
          set((state) => ({
            windows:
              state.windows.map(
                (window) =>
                  window.chromeWindowId ===
                    chromeWindowId
                    ? {
                      ...window,
                      isArchived: false,
                    }
                    : window
              ),
          }));

          const {
            existing,
            now,
          } =
            await getWorkspaceData(
              chromeWindowId
            );

          await saveWorkspace(
            buildWorkspace(
              chromeWindowId,
              existing,
              now,
              {
                archived: false,
              }
            )
          );
        },

      deleteWorkspaceMetadata:
        async (
          chromeWindowId
        ) => {
          await removeWorkspace(
            chromeWindowId
          );

          await get().refreshWindows();
        },

      updateWindow: (
        id,
        updates
      ) =>
        set((state) => ({
          windows:
            state.windows.map(
              (window) =>
                window.id === id
                  ? {
                    ...window,
                    ...updates,
                  }
                  : window
            ),
        })),
    };
  });
