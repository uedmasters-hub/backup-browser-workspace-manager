import type {
  TabGroupColor,
  WorkspaceTab,
  WorkspaceTabGroup,
} from "../../types/tab";


/**
 * Move a group to the front of its window, just after any pinned tabs
 * (Chrome forbids placing a group before pinned tabs). Best-effort.
 */
async function moveGroupToFront(groupId: number): Promise<void> {
  if (!chrome.tabGroups?.move || !chrome.tabGroups?.get) {
    return;
  }
  try {
    const group = await chrome.tabGroups.get(groupId);
    const pinned = await chrome.tabs.query({
      windowId: group.windowId,
      pinned: true,
    });
    await chrome.tabGroups.move(groupId, { index: pinned.length });
  } catch {
    try {
      await chrome.tabGroups.move(groupId, { index: 0 });
    } catch {
      // Leave the group where Chrome placed it.
    }
  }
}

export const TAB_GROUP_ID_NONE = -1;

function requireTabIds(
  tabIds: number[]
): [number, ...number[]] {
  const [first, ...rest] = tabIds;

  if (first === undefined) {
    throw new Error("At least one tab is required");
  }

  return [first, ...rest];
}

export async function getTabGroups(
  windowId: number,
  tabs: WorkspaceTab[]
): Promise<WorkspaceTabGroup[]> {
  if (!chrome.tabGroups?.query) {
    return [];
  }

  const groups = await chrome.tabGroups.query({
    windowId,
  });

  return groups.map((group) => {
    const groupTabs = tabs.filter(
      (tab) => tab.groupId === group.id
    );
    const indexes = groupTabs.map((tab) => tab.index);

    return {
      id: group.id,
      windowId: group.windowId,
      title: group.title ?? "Untitled group",
      color: group.color,
      collapsed: group.collapsed,
      tabCount: groupTabs.length,
      firstIndex:
        indexes.length > 0
          ? Math.min(...indexes)
          : Number.MAX_SAFE_INTEGER,
      lastIndex:
        indexes.length > 0
          ? Math.max(...indexes)
          : Number.MAX_SAFE_INTEGER,
    };
  });
}

export async function createTabGroup(
  tabIds: number[]
): Promise<number> {
  const groupId = await (chrome.tabs.group({
    tabIds: requireTabIds(tabIds),
  }) as Promise<number>);

  await chrome.tabGroups.update(groupId, {
    title: "New group",
  });

  // Keep groups first in the window (after pinned tabs).
  await moveGroupToFront(groupId);

  return groupId;
}

/**
 * Group an arbitrary set of tabs (e.g. search selection). Tabs from different
 * windows are first gathered into one window, then grouped and titled.
 */
export async function groupTabsByIds(
  tabIds: number[],
  title?: string
): Promise<number> {
  const ids = requireTabIds(tabIds);

  const tabs = await Promise.all(
    ids.map((id) => chrome.tabs.get(id))
  );
  const targetWindow = tabs[0].windowId;

  if (tabs.some((tab) => tab.windowId !== targetWindow)) {
    await chrome.tabs.move(ids, {
      windowId: targetWindow,
      index: -1,
    });
  }

  const groupId = await (chrome.tabs.group({
    tabIds: ids,
  }) as Promise<number>);

  if (chrome.tabGroups?.update) {
    await chrome.tabGroups.update(groupId, {
      title: title?.trim() || "Group",
    });
  }

  // Keep the group (and its tabs) first in the window (after pinned tabs).
  await moveGroupToFront(groupId);

  await chrome.windows.update(targetWindow, { focused: true });

  return groupId;
}

export async function addTabsToGroup(
  tabIds: number[],
  groupId: number
): Promise<void> {
  await chrome.tabs.group({
    tabIds: requireTabIds(tabIds),
    groupId,
  });
}

export async function ungroupTabs(
  tabIds: number[]
): Promise<void> {
  if (tabIds.length > 0) {
    await chrome.tabs.ungroup(requireTabIds(tabIds));
  }
}

export async function updateTabGroup(
  groupId: number,
  updates: {
    title?: string;
    color?: TabGroupColor;
    collapsed?: boolean;
  }
): Promise<void> {
  await chrome.tabGroups.update(groupId, updates);
}

export async function moveTabGroup(
  groupId: number,
  index: number
): Promise<void> {
  await chrome.tabGroups.move(groupId, {
    index,
  });
}

export async function reorderTabs(
  tabIds: number[],
  startIndex: number
): Promise<void> {
  await chrome.tabs.move(requireTabIds(tabIds), {
    index: startIndex,
  });
}

export async function moveTabBefore(
  tabId: number,
  targetTabId: number
): Promise<void> {
  const target = await chrome.tabs.get(targetTabId);

  await chrome.tabs.move(tabId, {
    index: target.index,
  });
}

export function splitGroupTitle(title: string): {
  emoji?: string;
  name: string;
} {
  const separator = title.indexOf(" ");

  if (separator > 0) {
    const prefix = title.slice(0, separator);

    if (/\p{Extended_Pictographic}/u.test(prefix)) {
      return {
        emoji: prefix,
        name:
          title.slice(separator + 1).trim() ||
          "Untitled group",
      };
    }
  }

  return {
    name: title.trim() || "Untitled group",
  };
}

export function buildGroupTitle(
  name: string,
  emoji?: string
): string {
  const cleanName = name.trim() || "Untitled group";

  return emoji
    ? `${emoji} ${cleanName}`
    : cleanName;
}
