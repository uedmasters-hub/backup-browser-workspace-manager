import type { WorkspaceTab } from "../../types/tab";

import { getFavoriteTabUrls } from "../storage/tabFavoriteRepository";

function mapChromeTab(
  tab: chrome.tabs.Tab,
  favoriteUrls: Set<string>
): WorkspaceTab {
  const url = tab.url ?? "";

  return {
    id: tab.id ?? -1,
    windowId: tab.windowId,
    index: tab.index,
    groupId: tab.groupId,
    title: tab.title ?? "",
    url,
    favicon: tab.favIconUrl,
    favorite: favoriteUrls.has(url),
    pinned: tab.pinned,
    active: tab.active,
    audible: tab.audible ?? false,
    discarded: tab.discarded ?? false,
    lastAccessed: tab.lastAccessed,
  };
}

export async function getTabs(
  chromeWindowId: number
): Promise<WorkspaceTab[]> {
  const [tabs, favoriteUrls] = await Promise.all([
    chrome.tabs.query({
      windowId: chromeWindowId,
    }),
    getFavoriteTabUrls(),
  ]);

  const favorites = new Set(favoriteUrls);

  return tabs.map((tab) =>
    mapChromeTab(tab, favorites)
  );
}

export async function getAllTabs(): Promise<WorkspaceTab[]> {
  const [tabs, favoriteUrls] = await Promise.all([
    chrome.tabs.query({}),
    getFavoriteTabUrls(),
  ]);

  const favorites = new Set(favoriteUrls);

  return tabs.map((tab) =>
    mapChromeTab(tab, favorites)
  );
}

export async function getActiveTab(): Promise<
  WorkspaceTab | undefined
> {
  const [[tab], favoriteUrls] = await Promise.all([
    chrome.tabs.query({
      active: true,
      currentWindow: true,
    }),
    getFavoriteTabUrls(),
  ]);

  return tab
    ? mapChromeTab(tab, new Set(favoriteUrls))
    : undefined;
}
