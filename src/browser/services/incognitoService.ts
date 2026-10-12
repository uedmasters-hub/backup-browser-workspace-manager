/**
 * Private (Incognito) window support.
 *
 * Browsers hide private windows from every extension until the user turns on
 * "Allow in Private" (Brave) / "Allow in Incognito" (Chrome) for it — no
 * manifest key can grant that. These helpers detect the switch and take the
 * user straight to it.
 */

const IS_BRAVE =
  typeof navigator !== "undefined" &&
  "brave" in (navigator as Navigator & { brave?: unknown });

/** What this browser calls a private window and the setting that exposes it. */
export const PRIVATE_LABEL = IS_BRAVE
  ? { window: "Private", setting: "Allow in Private" }
  : { window: "Incognito", setting: "Allow in Incognito" };

export async function isIncognitoAllowed(): Promise<boolean> {
  try {
    return await chrome.extension.isAllowedIncognitoAccess();
  } catch {
    return false;
  }
}

/** Opens this extension's details page, where the private-window switch lives. */
export async function openExtensionSettings(): Promise<void> {
  await chrome.tabs.create({
    // Brave redirects chrome://extensions to brave://extensions.
    url: `chrome://extensions/?id=${chrome.runtime.id}`,
    active: true,
  });
}
