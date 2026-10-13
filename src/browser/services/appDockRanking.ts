/**
 * Pure logic for the app dock (no browser APIs, so it's unit-tested by
 * scripts/appDockHarness.ts).
 */

export interface DockHistoryItem {
  url: string;
  title?: string;
  visitCount?: number;
  typedCount?: number;
  lastVisitTime?: number;
}

export interface DockTab {
  id: number;
  windowId: number;
  url: string;
  title: string;
  favicon?: string;
  active: boolean;
  incognito: boolean;
  lastAccessed?: number;
}

export interface DockApp {
  /** Stable identity: host without "www.", plus a non-default port. */
  key: string;
  /** Where to open it: scheme + host the user actually visits, root path. */
  url: string;
  /** Accessible name (site title from its home page, else the host). */
  name: string;
  score: number;
}

export interface AppWindowMatch {
  windowId: number;
  /** The tab to switch to in that window (its active one, else most recent). */
  tabId: number;
  title: string;
  tabCount: number;
  incognito: boolean;
  lastAccessed: number;
}

export function appKey(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host) return null;
    return u.port ? `${host}:${u.port}` : host;
  } catch {
    return null;
  }
}

function rootUrl(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}/`;
}

function isRoot(url: string): boolean {
  try {
    const u = new URL(url);
    return (u.pathname === "/" || u.pathname === "") && !u.search;
  } catch {
    return false;
  }
}

function cleanTitle(title: string | undefined, fallback: string): string {
  const t = (title ?? "").trim();
  return t && t.length <= 60 ? t : fallback;
}

/**
 * Ranks apps by recent visits (typed visits count extra) plus a boost for
 * what's open right now. Private tabs never contribute.
 */
export function rankApps(
  history: DockHistoryItem[],
  openTabs: DockTab[],
  {
    hidden = [],
    limit = 16,
    since = 0,
  }: { hidden?: string[]; limit?: number; since?: number } = {}
): DockApp[] {
  type Acc = { score: number; url: string; urlWeight: number; rootTitle?: string };
  const byKey = new Map<string, Acc>();
  const hiddenSet = new Set(hidden);

  const add = (url: string, weight: number, title?: string) => {
    const key = appKey(url);
    if (!key || hiddenSet.has(key)) return;
    const acc = byKey.get(key) ?? { score: 0, url: rootUrl(url), urlWeight: -1 };
    acc.score += weight;
    // Open the scheme/host variant the user visits most (e.g. https + www).
    if (weight > acc.urlWeight) {
      acc.url = rootUrl(url);
      acc.urlWeight = weight;
    }
    if (isRoot(url) && title && !acc.rootTitle) acc.rootTitle = title;
    byKey.set(key, acc);
  };

  for (const item of history) {
    if (since && (item.lastVisitTime ?? 0) < since) continue;
    add(item.url, (item.visitCount ?? 1) + 2 * (item.typedCount ?? 0), item.title);
  }
  for (const tab of openTabs) {
    if (!tab.incognito) add(tab.url, 3, tab.title);
  }

  return [...byKey.entries()]
    .map(([key, acc]) => ({
      key,
      url: acc.url,
      name: cleanTitle(acc.rootTitle, key),
      score: acc.score,
    }))
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key))
    .slice(0, limit);
}

/** Every window where the app is open, most recently used first. */
export function windowsForApp(key: string, tabs: DockTab[]): AppWindowMatch[] {
  const byWindow = new Map<number, DockTab[]>();
  for (const tab of tabs) {
    if (appKey(tab.url) !== key) continue;
    const list = byWindow.get(tab.windowId) ?? [];
    list.push(tab);
    byWindow.set(tab.windowId, list);
  }

  return [...byWindow.entries()]
    .map(([windowId, list]) => {
      const best =
        list.find((t) => t.active) ??
        [...list].sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))[0];
      return {
        windowId,
        tabId: best.id,
        title: best.title || best.url,
        tabCount: list.length,
        incognito: best.incognito,
        lastAccessed: Math.max(...list.map((t) => t.lastAccessed ?? 0)),
      };
    })
    .sort((a, b) => b.lastAccessed - a.lastAccessed);
}

/** Best icon for an app from what's open now, if any. */
export function iconFromTabs(key: string, tabs: DockTab[]): string | undefined {
  return tabs.find((t) => appKey(t.url) === key && t.favicon && !t.incognito)?.favicon;
}
