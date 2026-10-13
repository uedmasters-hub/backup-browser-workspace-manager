import { TAB_PREVIEW } from "../../constants/tabPreview";

/**
 * Data behind the tab hover preview.
 *
 * Snapshots: whenever a tab is shown in a window, its visible area is
 * captured, shrunk and kept in chrome.storage.session — memory only, cleared
 * when the browser closes, never written to disk or included in backups.
 * Private (Incognito) tabs are never captured.
 *
 * Page details: read on demand from the open page's <meta> tags.
 */

export interface TabSnapshot {
  url: string;
  dataUrl: string;
  capturedAt: number;
}

export interface PageMeta {
  description: string;
  image: string;
  siteName: string;
}

const SNAPSHOT_PREFIX = "tabSnapshot:";
const SNAPSHOT_INDEX = "tabSnapshotIndex";

const snapshotKey = (tabId: number) => `${SNAPSHOT_PREFIX}${tabId}`;

function capturable(tab: chrome.tabs.Tab | undefined): tab is chrome.tabs.Tab & { id: number; url: string } {
  return Boolean(
    tab?.id !== undefined &&
      tab.url &&
      !tab.incognito &&
      /^(https?|file):/.test(tab.url)
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/** Shrinks a captured screenshot (works in the service worker and in pages). */
async function downscale(dataUrl: string): Promise<string> {
  if (typeof OffscreenCanvas === "undefined") return dataUrl;
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const scale = TAB_PREVIEW.thumbnailWidth / bitmap.width;
  if (scale >= 1) {
    bitmap.close();
    return dataUrl;
  }
  const canvas = new OffscreenCanvas(
    TAB_PREVIEW.thumbnailWidth,
    Math.round(bitmap.height * scale)
  );
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await canvas.convertToBlob({
    type: "image/jpeg",
    quality: TAB_PREVIEW.thumbnailQuality,
  });
  return blobToDataUrl(out);
}

/** Captures the tab currently showing in `windowId`, if it's allowed. */
export async function captureWindowSnapshot(windowId: number): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (!capturable(tab)) return;

    const raw = await chrome.tabs.captureVisibleTab(windowId, {
      format: "jpeg",
      quality: 70,
    });
    const snapshot: TabSnapshot = {
      url: tab.url,
      dataUrl: await downscale(raw),
      capturedAt: Date.now(),
    };

    const stored = await chrome.storage.session.get(SNAPSHOT_INDEX);
    const index = ((stored[SNAPSHOT_INDEX] as number[] | undefined) ?? []).filter(
      (id) => id !== tab.id
    );
    index.push(tab.id);
    const evicted = index.splice(0, Math.max(0, index.length - TAB_PREVIEW.maxThumbnails));

    await chrome.storage.session.set({
      [snapshotKey(tab.id)]: snapshot,
      [SNAPSHOT_INDEX]: index,
    });
    if (evicted.length) {
      await chrome.storage.session.remove(evicted.map(snapshotKey));
    }
  } catch {
    // Minimized window, restricted page, or capture rate limit — skip.
  }
}

/** The tab's latest snapshot, only if it still shows the same page. */
export async function getTabSnapshot(
  tabId: number,
  currentUrl: string
): Promise<TabSnapshot | null> {
  try {
    const key = snapshotKey(tabId);
    const stored = await chrome.storage.session.get(key);
    const snapshot = stored[key] as TabSnapshot | undefined;
    return snapshot && snapshot.url === currentUrl ? snapshot : null;
  } catch {
    return null;
  }
}

export async function forgetTabSnapshot(tabId: number): Promise<void> {
  try {
    await chrome.storage.session.remove(snapshotKey(tabId));
  } catch {
    // ignore
  }
}

const metaCache = new Map<string, PageMeta | null>();

/** Description, share image and site name from the page's meta tags. */
export async function getPageMeta(
  tabId: number,
  url: string,
  discarded: boolean
): Promise<PageMeta | null> {
  const cacheKey = `${tabId}|${url}`;
  if (metaCache.has(cacheKey)) return metaCache.get(cacheKey) ?? null;
  if (discarded || !/^(https?|file):/.test(url)) return null;

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const pick = (selector: string) =>
          document.querySelector(selector)?.getAttribute("content")?.trim() ?? "";
        return {
          description:
            pick('meta[property="og:description"]') ||
            pick('meta[name="description"]') ||
            pick('meta[name="twitter:description"]'),
          image:
            pick('meta[property="og:image"]') ||
            pick('meta[name="twitter:image"]'),
          siteName: pick('meta[property="og:site_name"]'),
        };
      },
    });
    const raw = result?.result as PageMeta | undefined;
    let image = "";
    if (raw?.image) {
      try {
        const resolved = new URL(raw.image, url);
        if (resolved.protocol === "https:" || resolved.protocol === "http:") {
          image = resolved.href;
        }
      } catch {
        // bad URL — no image
      }
    }
    const meta = raw
      ? {
          description: raw.description.slice(0, 300),
          image,
          siteName: raw.siteName.slice(0, 60),
        }
      : null;
    metaCache.set(cacheKey, meta);
    return meta;
  } catch {
    metaCache.set(cacheKey, null);
    return null;
  }
}
