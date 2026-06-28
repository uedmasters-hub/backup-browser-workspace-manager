import { useWindowStore } from "../../stores/windowStore";
import { useTabStore } from "../../stores/tabStore";

export function registerWindowEvents() {
  const refresh = () => {
    void useWindowStore.getState().refreshWindows();
    void useTabStore.getState().reloadTabs();
  };

  const events: Array<{
    addListener(callback: () => void): void;
    removeListener(callback: () => void): void;
  }> = [
    chrome.windows.onCreated,
    chrome.windows.onRemoved,
    chrome.windows.onFocusChanged,
    chrome.tabs.onCreated,
    chrome.tabs.onRemoved,
    chrome.tabs.onUpdated,
    chrome.tabs.onMoved,
    chrome.tabs.onAttached,
    chrome.tabs.onDetached,
    chrome.tabs.onActivated,
  ];

  // The namespace is unavailable until Chrome reloads the extension with
  // the new tabGroups permission. Treat that stale-manifest state safely.
  if (chrome.tabGroups) {
    events.push(
      chrome.tabGroups.onCreated,
      chrome.tabGroups.onUpdated,
      chrome.tabGroups.onMoved,
      chrome.tabGroups.onRemoved
    );
  }

  for (const event of events) {
    event.addListener(refresh);
  }

  return () => {
    for (const event of events) {
      event.removeListener(refresh);
    }
  };
}
