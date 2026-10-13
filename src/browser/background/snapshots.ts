import {
  captureWindowSnapshot,
  forgetTabSnapshot,
} from "../services/tabPreviewService";

/**
 * Keeps hover-preview snapshots fresh: after a tab is shown or finishes
 * loading, capture it once things settle. The browser allows ~2 captures a
 * second, so captures are debounced per window and run one at a time.
 */
const pending = new Map<number, ReturnType<typeof setTimeout>>();
let queue: Promise<void> = Promise.resolve();

function schedule(windowId: number, delayMs: number) {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  clearTimeout(pending.get(windowId));
  pending.set(
    windowId,
    setTimeout(() => {
      pending.delete(windowId);
      queue = queue
        .then(() => captureWindowSnapshot(windowId))
        .then(() => new Promise((r) => setTimeout(r, 550)));
    }, delayMs)
  );
}

export function registerSnapshotCapture() {
  chrome.tabs.onActivated.addListener(({ windowId }) => schedule(windowId, 700));

  chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
    if (info.status === "complete" && tab.active) {
      schedule(tab.windowId, 400);
    }
  });

  chrome.windows.onFocusChanged.addListener((windowId) => schedule(windowId, 500));

  chrome.tabs.onRemoved.addListener((tabId) => void forgetTabSnapshot(tabId));
}
