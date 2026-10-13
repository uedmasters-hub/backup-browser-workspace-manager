import { APP_DOCK } from "../../constants/appDock";
import {
  appKey,
  rankApps,
  type DockApp,
  type DockHistoryItem,
  type DockTab,
} from "./appDockRanking";

/**
 * Browser side of the app dock.
 *
 * Ranking reads your history (already permitted) and is cached in memory
 * (chrome.storage.session) for a few minutes — nothing about visited sites is
 * written to disk. Icons come from open tabs; the last one seen per app is
 * remembered in memory too, and sites not open fall back to their own
 * /favicon.ico.
 */

const RANK_CACHE = "appDockRanking";
const ICON_CACHE = "appDockIcons";
const HIRES_CACHE = "appDockHiResIcons";
const MAX_ICON_BYTES = 24_000;

export async function getOpenDockTabs(): Promise<DockTab[]> {
  const tabs = await chrome.tabs.query({});
  return tabs
    .filter((t) => t.id !== undefined && t.url)
    .map((t) => ({
      id: t.id!,
      windowId: t.windowId,
      url: t.url!,
      title: t.title ?? "",
      favicon: t.favIconUrl,
      active: t.active,
      incognito: t.incognito,
      lastAccessed: t.lastAccessed,
    }));
}

async function readHistory(): Promise<DockHistoryItem[]> {
  const since = Date.now() - APP_DOCK.historyDays * 86_400_000;
  const items = await chrome.history.search({
    text: "",
    startTime: since,
    maxResults: 5000,
  });
  return items
    .filter((i) => i.url)
    .map((i) => ({
      url: i.url!,
      title: i.title,
      visitCount: i.visitCount,
      typedCount: i.typedCount,
      lastVisitTime: i.lastVisitTime,
    }));
}

/** Top apps, using the in-memory ranking if it's fresh. */
export async function getTopApps(
  openTabs: DockTab[],
  hidden: string[]
): Promise<DockApp[]> {
  let history: DockHistoryItem[] | null = null;
  try {
    const cached = await chrome.storage.session.get(RANK_CACHE);
    const entry = cached[RANK_CACHE] as { at: number; history: DockHistoryItem[] } | undefined;
    if (entry && Date.now() - entry.at < APP_DOCK.rankingCacheMs) history = entry.history;
  } catch {
    // no session storage — just read history
  }

  if (!history) {
    try {
      // Keep only what ranking needs, newest-visited first, to stay small.
      history = (await readHistory())
        .sort((a, b) => (b.visitCount ?? 0) - (a.visitCount ?? 0))
        .slice(0, 1500);
      await chrome.storage.session
        .set({ [RANK_CACHE]: { at: Date.now(), history } })
        .catch(() => undefined);
    } catch {
      history = [];
    }
  }

  return rankApps(history, openTabs, {
    hidden,
    limit: APP_DOCK.limit,
    since: Date.now() - APP_DOCK.historyDays * 86_400_000,
  });
}

/** Remember the latest icon per app from open, non-private tabs (memory only). */
export async function rememberAppIcons(tabs: DockTab[]): Promise<Record<string, string>> {
  try {
    const stored = await chrome.storage.session.get(ICON_CACHE);
    const icons = { ...((stored[ICON_CACHE] as Record<string, string> | undefined) ?? {}) };
    let changed = false;
    for (const tab of tabs) {
      if (tab.incognito || !tab.favicon) continue;
      if (tab.favicon.startsWith("data:") && tab.favicon.length > MAX_ICON_BYTES) continue;
      const key = appKey(tab.url);
      if (key && icons[key] !== tab.favicon) {
        icons[key] = tab.favicon;
        changed = true;
      }
    }
    if (changed) await chrome.storage.session.set({ [ICON_CACHE]: icons });
    return icons;
  } catch {
    return {};
  }
}

export async function switchToTab(tabId: number, windowId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
  await chrome.windows.update(windowId, { focused: true });
}

export async function openAppInNewWindow(url: string): Promise<void> {
  await chrome.windows.create({ url, focused: true });
}

/** New tab next to the one the user is on. */
export async function openAppInNewTab(url: string): Promise<void> {
  const [current] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.create({
    url,
    active: true,
    ...(current && !current.incognito
      ? { windowId: current.windowId, index: current.index + 1 }
      : {}),
  });
}

/**
 * Sharp icons: favicons are often 16px, which blur when shown at 28px on a
 * Retina screen. For each dock app that's open, read the page's best icon
 * (an SVG icon, an Apple touch icon, or the largest declared size) once per
 * session. Results — including "none found" — are kept in memory only.
 */
export async function collectHiResIcons(
  keys: string[],
  tabs: DockTab[]
): Promise<Record<string, string>> {
  let cache: Record<string, string> = {};
  try {
    const stored = await chrome.storage.session.get(HIRES_CACHE);
    cache = { ...((stored[HIRES_CACHE] as Record<string, string> | undefined) ?? {}) };
  } catch {
    return {};
  }

  const todo = keys.filter((k) => !(k in cache));
  await Promise.all(
    todo.map(async (key) => {
      const tab = tabs.find(
        (t) => !t.incognito && appKey(t.url) === key && /^https?:/.test(t.url)
      );
      if (!tab) return; // not open — try again another time
      try {
        const [res] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            const links = [
              ...document.querySelectorAll<HTMLLinkElement>(
                'link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]'
              ),
            ];
            let best = "";
            let bestScore = 0;
            for (const link of links) {
              if (!link.href) continue;
              const isSvg = link.type === "image/svg+xml" || /\.svg(\?|$)/i.test(link.href);
              const sizes = (link.getAttribute("sizes") ?? "")
                .split(/\s+/)
                .map((s) => parseInt(s, 10))
                .filter((n) => n > 0);
              const touch = link.rel.includes("apple-touch-icon");
              const score = isSvg ? 1000 : sizes.length ? Math.max(...sizes) : touch ? 180 : 16;
              if (score > bestScore) {
                best = link.href;
                bestScore = score;
              }
            }
            return bestScore >= 48 ? best : "";
          },
        });
        cache[key] = typeof res?.result === "string" ? res.result : "";
      } catch {
        cache[key] = "";
      }
    })
  );

  if (todo.length) {
    await chrome.storage.session.set({ [HIRES_CACHE]: cache }).catch(() => undefined);
  }
  return cache;
}
