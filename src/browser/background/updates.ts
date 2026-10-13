import {
  recordUpdateReady,
  recordUpdated,
} from "../services/updateService";

export function registerUpdateNotices() {
  chrome.runtime.onInstalled.addListener(({ reason, previousVersion }) => {
    const current = chrome.runtime.getManifest().version;
    // Reloading an unpacked build also reports "update" — only a real version
    // change counts.
    if (reason === "update" && previousVersion && previousVersion !== current) {
      void recordUpdated(previousVersion, current);
    }
  });

  chrome.runtime.onUpdateAvailable.addListener(({ version }) => {
    void recordUpdateReady(version);
  });
}
