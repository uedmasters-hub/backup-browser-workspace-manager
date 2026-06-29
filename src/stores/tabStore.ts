import { create } from "zustand";

import { getTabs } from "../browser/services/tabService";
import {
  addTabsToGroup,
  buildGroupTitle,
  createTabGroup,
  getTabGroups,
  moveTabGroup,
  moveTabBefore as moveChromeTabBefore,
  reorderTabs,
  splitGroupTitle,
  ungroupTabs,
  updateTabGroup,
} from "../browser/services/tabGroupService";

import {
  closeTabs,
  pinTabs,
  duplicateTabs,
  moveTabs,
  activateTab as activateChromeTab,
} from "../browser/services/tabActionService";

import { useWindowStore } from "./windowStore";

import { setTabFavorite } from "../browser/storage/tabFavoriteRepository";

import type {
  TabGroupColor,
  WorkspaceTab,
  WorkspaceTabGroup,
} from "../types/tab";

interface TabState {
  tabs: WorkspaceTab[];

  groups: WorkspaceTabGroup[];

  currentWindowId?: number;

  selectionMode: boolean;

  selectedTabs: number[];
}

interface TabActions {
  loadTabs: (
    chromeWindowId: number
  ) => Promise<void>;

  reloadTabs: () => Promise<void>;

  /** Switch to a tab: activate it and focus its window. */
  activateTab: (
    tabId: number
  ) => Promise<void>;

  toggleFavorite: (
    tabId: number
  ) => Promise<void>;

  toggleSelectionMode: () => void;

  toggleTabSelection: (
    tabId: number
  ) => void;

  clearSelection: () => void;

  selectAllTabs: () => void;

  closeSelectedTabs: () => Promise<void>;
  closeTab: (id: number) => Promise<void>;

  pinSelectedTabs: () => Promise<void>;

  duplicateSelectedTabs: () => Promise<void>;

  moveSelectedTabs: (
    targetWindowId: number
  ) => Promise<void>;

  groupSelectedTabs: (
    groupId?: number
  ) => Promise<void>;

  ungroupSelectedTabs: () => Promise<void>;

  toggleGroupCollapsed: (
    groupId: number
  ) => Promise<void>;

  renameGroup: (
    groupId: number,
    name: string
  ) => Promise<void>;

  updateGroupColor: (
    groupId: number,
    color: TabGroupColor
  ) => Promise<void>;

  updateGroupEmoji: (
    groupId: number,
    emoji?: string
  ) => Promise<void>;

  ungroupGroup: (
    groupId: number
  ) => Promise<void>;

  moveGroup: (
    groupId: number,
    direction: "left" | "right"
  ) => Promise<void>;

  shuffleGroupTabs: (
    groupId: number
  ) => Promise<void>;

  moveTabBefore: (
    tabId: number,
    targetTabId: number
  ) => Promise<void>;

  moveTabToGroup: (
    tabId: number,
    groupId?: number
  ) => Promise<void>;

  moveGroupBefore: (
    groupId: number,
    targetGroupId: number
  ) => Promise<void>;
}

type TabStore = TabState & TabActions;

async function getTabSnapshot(windowId: number) {
  const tabs = await getTabs(windowId);
  const groups = await getTabGroups(windowId, tabs);

  return { tabs, groups };
}

/**
 * Reloads the tabs for the window currently in view and keeps the
 * window list (tab counts) in sync after any mutation.
 */
async function syncAfterMutation(
  get: () => TabStore,
  set: (partial: Partial<TabState>) => void
) {
  const windowId = get().currentWindowId;

  if (windowId !== undefined) {
    const snapshot = await getTabSnapshot(windowId);
    set(snapshot);
  }

  await useWindowStore.getState().refreshWindows();
}

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],

  groups: [],

  currentWindowId: undefined,

  selectionMode: false,

  selectedTabs: [],

  loadTabs: async (chromeWindowId) => {
    const snapshot = await getTabSnapshot(chromeWindowId);

    set({
      ...snapshot,
      currentWindowId: chromeWindowId,
      selectedTabs: [],
    });
  },

  reloadTabs: async () => {
    const windowId = get().currentWindowId;

    if (windowId === undefined) {
      return;
    }

    const snapshot = await getTabSnapshot(windowId);

    set(snapshot);
  },

  activateTab: async (tabId) => {
    const tab = get().tabs.find((item) => item.id === tabId);

    if (!tab) {
      console.warn("[activateTab] no tab in store for id", tabId);
      return;
    }

    try {
      await activateChromeTab(tabId, tab.windowId);

      // Switching focuses the target window; close the popup so the tab is
      // front and center.
      if (typeof window !== "undefined") {
        window.close();
      }
    } catch (error) {
      console.error("[activateTab] failed to switch to tab", tabId, error);
    }
  },

  toggleFavorite: async (tabId) => {
    const tab = get().tabs.find(
      (item) => item.id === tabId
    );

    if (!tab?.url) {
      return;
    }

    const favorite = !tab.favorite;

    set((state) => ({
      tabs: state.tabs.map((item) =>
        item.url === tab.url
          ? { ...item, favorite }
          : item
      ),
    }));

    try {
      await setTabFavorite(tab.url, favorite);
    } catch (error) {
      set((state) => ({
        tabs: state.tabs.map((item) =>
          item.url === tab.url
            ? { ...item, favorite: !favorite }
            : item
        ),
      }));

      console.error(
        "[toggleFavorite] failed to save tab favorite",
        tabId,
        error
      );
    }
  },

  toggleSelectionMode: () =>
    set((state) => ({
      selectionMode: !state.selectionMode,
      selectedTabs: [],
    })),

  toggleTabSelection: (tabId) =>
    set((state) => ({
      selectedTabs: state.selectedTabs.includes(tabId)
        ? state.selectedTabs.filter((id) => id !== tabId)
        : [...state.selectedTabs, tabId],
    })),

  clearSelection: () => set({ selectedTabs: [] }),

  selectAllTabs: () =>
    set((state) => ({
      selectedTabs: state.tabs.map((tab) => tab.id),
    })),

  closeTab: async (id) => {
    await closeTabs([id]);
    await syncAfterMutation(get, set);
  },

  closeSelectedTabs: async () => {
    const { selectedTabs } = get();

    if (selectedTabs.length === 0) {
      return;
    }

    await closeTabs(selectedTabs);

    set({ selectedTabs: [], selectionMode: false });

    await syncAfterMutation(get, set);
  },

  pinSelectedTabs: async () => {
    const { selectedTabs, tabs } = get();

    if (selectedTabs.length === 0) {
      return;
    }

    const allPinned = selectedTabs.every(
      (id) => tabs.find((tab) => tab.id === id)?.pinned
    );

    await pinTabs(selectedTabs, !allPinned);

    await syncAfterMutation(get, set);
  },

  duplicateSelectedTabs: async () => {
    const { selectedTabs } = get();

    if (selectedTabs.length === 0) {
      return;
    }

    await duplicateTabs(selectedTabs);

    await syncAfterMutation(get, set);
  },

  moveSelectedTabs: async (targetWindowId) => {
    const { selectedTabs } = get();

    if (selectedTabs.length === 0) {
      return;
    }

    await moveTabs(selectedTabs, targetWindowId);

    set({ selectedTabs: [], selectionMode: false });

    await syncAfterMutation(get, set);
  },

  groupSelectedTabs: async (groupId) => {
    const { selectedTabs } = get();

    if (selectedTabs.length === 0) {
      return;
    }

    if (groupId === undefined) {
      await createTabGroup(selectedTabs);
    } else {
      await addTabsToGroup(selectedTabs, groupId);
    }

    set({ selectedTabs: [], selectionMode: false });

    await syncAfterMutation(get, set);
  },

  ungroupSelectedTabs: async () => {
    const { selectedTabs, tabs } = get();
    const groupedIds = selectedTabs.filter(
      (id) =>
        tabs.find((tab) => tab.id === id)?.groupId !== -1
    );

    if (groupedIds.length === 0) {
      return;
    }

    await ungroupTabs(groupedIds);

    set({ selectedTabs: [], selectionMode: false });

    await syncAfterMutation(get, set);
  },

  toggleGroupCollapsed: async (groupId) => {
    const group = get().groups.find(
      (item) => item.id === groupId
    );

    if (!group) {
      return;
    }

    const collapsed = !group.collapsed;

    set((state) => ({
      groups: state.groups.map((item) =>
        item.id === groupId
          ? { ...item, collapsed }
          : item
      ),
    }));

    await updateTabGroup(groupId, { collapsed });
  },

  renameGroup: async (groupId, name) => {
    const group = get().groups.find(
      (item) => item.id === groupId
    );

    if (!group) {
      return;
    }

    const { emoji } = splitGroupTitle(group.title);

    await updateTabGroup(groupId, {
      title: buildGroupTitle(name, emoji),
    });

    await syncAfterMutation(get, set);
  },

  updateGroupColor: async (groupId, color) => {
    await updateTabGroup(groupId, { color });
    await syncAfterMutation(get, set);
  },

  updateGroupEmoji: async (groupId, emoji) => {
    const group = get().groups.find(
      (item) => item.id === groupId
    );

    if (!group) {
      return;
    }

    const { name } = splitGroupTitle(group.title);

    await updateTabGroup(groupId, {
      title: buildGroupTitle(name, emoji),
    });

    await syncAfterMutation(get, set);
  },

  ungroupGroup: async (groupId) => {
    const tabIds = get()
      .tabs
      .filter((tab) => tab.groupId === groupId)
      .map((tab) => tab.id);

    await ungroupTabs(tabIds);
    await syncAfterMutation(get, set);
  },

  moveGroup: async (groupId, direction) => {
    const groups = [...get().groups].sort(
      (a, b) => a.firstIndex - b.firstIndex
    );
    const index = groups.findIndex(
      (group) => group.id === groupId
    );
    const target =
      direction === "left"
        ? groups[index - 1]
        : groups[index + 1];

    if (!target) {
      return;
    }

    await moveTabGroup(
      groupId,
      direction === "left"
        ? target.firstIndex
        : target.lastIndex + 1
    );

    await syncAfterMutation(get, set);
  },

  shuffleGroupTabs: async (groupId) => {
    const tabs = get()
      .tabs
      .filter((tab) => tab.groupId === groupId)
      .sort((a, b) => a.index - b.index);

    if (tabs.length < 2) {
      return;
    }

    const shuffled = tabs.map((tab) => tab.id);

    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(
        Math.random() * (index + 1)
      );

      [shuffled[index], shuffled[swapIndex]] = [
        shuffled[swapIndex],
        shuffled[index],
      ];
    }

    await reorderTabs(shuffled, tabs[0].index);
    await syncAfterMutation(get, set);
  },

  moveTabBefore: async (tabId, targetTabId) => {
    if (tabId === targetTabId) {
      return;
    }

    const source = get().tabs.find((tab) => tab.id === tabId);
    const target = get().tabs.find(
      (tab) => tab.id === targetTabId
    );

    if (!source || !target) {
      return;
    }

    if (source.groupId !== target.groupId) {
      if (target.groupId === -1) {
        await ungroupTabs([tabId]);
      } else {
        await addTabsToGroup([tabId], target.groupId);
      }
    }

    await moveChromeTabBefore(tabId, targetTabId);
    await syncAfterMutation(get, set);
  },

  moveTabToGroup: async (tabId, groupId) => {
    const tab = get().tabs.find((item) => item.id === tabId);

    if (!tab) {
      return;
    }

    if (groupId === undefined) {
      if (tab.groupId !== -1) {
        await ungroupTabs([tabId]);
      }
    } else if (tab.groupId !== groupId) {
      await addTabsToGroup([tabId], groupId);
    }

    await syncAfterMutation(get, set);
  },

  moveGroupBefore: async (groupId, targetGroupId) => {
    if (groupId === targetGroupId) {
      return;
    }

    const target = get().groups.find(
      (group) => group.id === targetGroupId
    );

    if (!target) {
      return;
    }

    await moveTabGroup(groupId, target.firstIndex);
    await syncAfterMutation(get, set);
  },
}));
