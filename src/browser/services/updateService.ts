import { STORAGE_KEYS } from "../../constants/storageKeys";

/**
 * Tells users about extension updates — browsers install them silently.
 *
 * - "ready":   a new version is downloaded and waiting (it installs on its own
 *              once the extension is idle; "Restart" installs it right away).
 * - "updated": the extension just updated; show what's new once.
 *
 * Uses chrome.runtime + chrome.action only — no extra permissions.
 */

export interface UpdatedNotice {
  from: string;
  to: string;
  at: number;
}

export interface UpdateState {
  ready?: string;
  updated?: UpdatedNotice;
}

/** In memory (storage.session): only meaningful until the update installs. */
const READY_KEY = "updateReadyVersion";
/** Ask the browser at most this often, and only when the popup opens. */
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** Stop showing "what's new" after this long even if never dismissed. */
const NOTICE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

async function setBadge(text: string, color: string) {
  try {
    await chrome.action.setBadgeBackgroundColor({ color });
    await chrome.action.setBadgeText({ text });
  } catch {
    // badge unavailable — ignore
  }
}

export async function clearUpdateBadge(): Promise<void> {
  try {
    await chrome.action.setBadgeText({ text: "" });
  } catch {
    // ignore
  }
}

/** Background: the extension was just updated from `from` to `to`. */
export async function recordUpdated(from: string, to: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.UPDATE_NOTICE]: { from, to, at: Date.now() } satisfies UpdatedNotice,
  });
  await chrome.storage.session.remove(READY_KEY).catch(() => undefined);
  await setBadge("NEW", "#4F46E5");
}

/** Background/popup: a newer version is downloaded and waiting. */
export async function recordUpdateReady(version: string): Promise<void> {
  await chrome.storage.session.set({ [READY_KEY]: version }).catch(() => undefined);
  await setBadge("↑", "#059669");
}

export async function getUpdateState(): Promise<UpdateState> {
  const [local, session] = await Promise.all([
    chrome.storage.local.get(STORAGE_KEYS.UPDATE_NOTICE),
    chrome.storage.session.get(READY_KEY).catch(() => ({}) as Record<string, unknown>),
  ]);
  const current = chrome.runtime.getManifest().version;
  const ready = session[READY_KEY] as string | undefined;
  const updated = local[STORAGE_KEYS.UPDATE_NOTICE] as UpdatedNotice | undefined;

  return {
    ready: ready && ready !== current ? ready : undefined,
    updated:
      updated && updated.to === current && Date.now() - updated.at < NOTICE_TTL_MS
        ? updated
        : undefined,
  };
}

export async function dismissUpdatedNotice(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.UPDATE_NOTICE);
  await clearUpdateBadge();
}

/**
 * Popup: politely ask the browser whether a newer version exists (at most
 * every 6 hours). Returns the waiting version, if any.
 */
export async function checkForUpdate(): Promise<string | undefined> {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEYS.LAST_UPDATE_CHECK);
    const last = Number(stored[STORAGE_KEYS.LAST_UPDATE_CHECK] ?? 0);
    if (Date.now() - last < CHECK_INTERVAL_MS) return undefined;
    await chrome.storage.local.set({ [STORAGE_KEYS.LAST_UPDATE_CHECK]: Date.now() });

    const result = (await chrome.runtime.requestUpdateCheck()) as unknown as {
      status: string;
      version?: string;
    };
    if (result?.status === "update_available" && result.version) {
      await recordUpdateReady(result.version);
      return result.version;
    }
  } catch {
    // unpacked/dev builds and unsupported browsers — nothing to do
  }
  return undefined;
}

/** Installs a waiting update now. Closes the popup; all data is kept. */
export function applyUpdate(): void {
  chrome.runtime.reload();
}
