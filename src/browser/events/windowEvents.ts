import { useWindowStore } from "../../stores/windowStore";
import { useTabStore } from "../../stores/tabStore";

/**
 * Keeps the popup live while it's open: window cards on any change, and the
 * tab list when tabs or groups change (opened, closed, renamed, navigated,
 * grouped — including by Auto Group Tabs in the background).
 */
export function registerWindowEvents() {
  const refresh = () => {
    useWindowStore.getState().refreshWindows();
  };

  let tabTimer: ReturnType<typeof setTimeout> | undefined;
  const refreshTabs = () => {
    clearTimeout(tabTimer);
    tabTimer = setTimeout(() => void useTabStore.getState().reloadTabs(), 150);
  };

  const onTabChange = () => {
    refresh();
    refreshTabs();
  };

  // Title, address, group, pin, sound — not every loading tick.
  const onTabUpdated = (_id: number, change: chrome.tabs.OnUpdatedInfo) => {
    refresh();
    if (
      change.url !== undefined ||
      change.title !== undefined ||
      change.groupId !== undefined ||
      change.pinned !== undefined ||
      change.audible !== undefined ||
      change.mutedInfo !== undefined ||
      change.favIconUrl !== undefined ||
      change.discarded !== undefined
    ) {
      refreshTabs();
    }
  };

  chrome.windows.onCreated.addListener(refresh);
  chrome.windows.onRemoved.addListener(refresh);
  chrome.windows.onFocusChanged.addListener(refresh);

  chrome.tabs.onCreated.addListener(onTabChange);
  chrome.tabs.onRemoved.addListener(onTabChange);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.tabs.onMoved.addListener(onTabChange);
  chrome.tabs.onAttached.addListener(onTabChange);
  chrome.tabs.onDetached.addListener(onTabChange);

  const groupEvents = chrome.tabGroups
    ? [chrome.tabGroups.onCreated, chrome.tabGroups.onUpdated, chrome.tabGroups.onRemoved, chrome.tabGroups.onMoved]
    : [];
  for (const event of groupEvents) event.addListener(refreshTabs);

  return () => {
    clearTimeout(tabTimer);
    chrome.windows.onCreated.removeListener(refresh);
    chrome.windows.onRemoved.removeListener(refresh);
    chrome.windows.onFocusChanged.removeListener(refresh);
    chrome.tabs.onCreated.removeListener(onTabChange);
    chrome.tabs.onRemoved.removeListener(onTabChange);
    chrome.tabs.onUpdated.removeListener(onTabUpdated);
    chrome.tabs.onMoved.removeListener(onTabChange);
    chrome.tabs.onAttached.removeListener(onTabChange);
    chrome.tabs.onDetached.removeListener(onTabChange);
    for (const event of groupEvents) event.removeListener(refreshTabs);
  };
}
