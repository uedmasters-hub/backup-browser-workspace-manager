import { STORAGE_KEYS } from "../../constants/storageKeys";

export async function getPrivateHintDismissed(): Promise<boolean> {
  const result = await chrome.storage.local.get(
    STORAGE_KEYS.PRIVATE_HINT_DISMISSED
  );
  return result[STORAGE_KEYS.PRIVATE_HINT_DISMISSED] === true;
}

export async function setPrivateHintDismissed(): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.PRIVATE_HINT_DISMISSED]: true,
  });
}

/** App dock on/off (default on). */
export async function getAppDockEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.APP_DOCK_ENABLED);
  return result[STORAGE_KEYS.APP_DOCK_ENABLED] !== false;
}

export async function setAppDockEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.APP_DOCK_ENABLED]: enabled });
}

/** Apps the user removed from the dock (by app key, e.g. "youtube.com"). */
export async function getAppDockHidden(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.APP_DOCK_HIDDEN);
  const list = result[STORAGE_KEYS.APP_DOCK_HIDDEN];
  return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
}

export async function setAppDockHidden(keys: string[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.APP_DOCK_HIDDEN]: keys });
}
