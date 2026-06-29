import { useWindowStore } from "../../stores/windowStore";

export function registerWindowEvents() {
  const refresh = () => {
    useWindowStore.getState().refreshWindows();
  };

  chrome.windows.onCreated.addListener(refresh);

  chrome.windows.onRemoved.addListener(refresh);

  chrome.windows.onFocusChanged.addListener(refresh);

  chrome.tabs.onCreated.addListener(refresh);

  chrome.tabs.onRemoved.addListener(refresh);

  chrome.tabs.onUpdated.addListener(refresh);

  chrome.tabs.onMoved.addListener(refresh);

  chrome.tabs.onAttached.addListener(refresh);

  chrome.tabs.onDetached.addListener(refresh);
}