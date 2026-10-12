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
