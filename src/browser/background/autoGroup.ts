/**
 * Auto Group Tabs — the background side. Owns every change it makes to tab
 * groups so it can tell its own moves from the user's.
 *
 *  - "Group tabs" (from the popup) puts every loose tab into its category and
 *    turns auto-grouping on. It can be undone.
 *  - While on, new tabs and tabs that move to another site are placed as
 *    they load, a window at a time, a moment after things settle.
 *  - A tab the user moves by hand (into a group, out of one, between groups)
 *    is left alone until it goes to a different site.
 *  - Never touched: pinned tabs, tabs in the user's own groups, tabs in other
 *    windows (nothing moves between windows), and anything while it's off.
 *
 * What it remembers (tab and group ids, and the site each was on) lives in
 * chrome.storage.session — in memory only, gone when the browser closes.
 */
import { STORAGE_KEYS } from "../../constants/storageKeys";
import {
  categorize,
  groupKeyForTab,
  planAutoGroups,
  resolveGroupKey,
  siteOf,
  type AutoGroupPlan,
  type PageMeta,
  type PlanTab,
  type Strength,
} from "../services/tabCategories";
import { addTabsToGroup, groupTabsInWindow, ungroupTabs } from "../services/tabGroupService";
import {
  AUTO_GROUP_MESSAGE,
  type ApplyResult,
  type AutoGroupMode,
  type AutoGroupPreview,
  type AutoGroupRequest,
  type PreviewGroup,
} from "../services/autoGroupService";

interface Placement {
  key: string;
  site: string;
  strength: Strength | "group";
}

interface UndoRecord {
  at: number;
  tabs: Array<{ id: number; windowId: number; index: number }>;
}

interface State {
  /** Tabs the user placed by hand → the site they were on. */
  manual: Record<string, string>;
  /** Tabs this feature placed → their category. */
  placed: Record<string, Placement>;
  /** New tabs not looked at yet → when they opened. */
  fresh: Record<string, number>;
  /** Groups this feature made or joined → their key (survives renames). */
  groups: Record<string, string>;
  undo?: UndoRecord;
}

const SETTLE_MS = 700;
/** A group change right after a tab opens is the browser's (link opened from a grouped tab). */
const INHERIT_MS = 3000;
const OURS_MS = 4000;
const UNDO_FOR_MS = 30 * 60_000;

let mode: AutoGroupMode | undefined;
const modeReady = chrome.storage.local.get(STORAGE_KEYS.AUTO_GROUP_MODE).then((r) => {
  const m = r[STORAGE_KEYS.AUTO_GROUP_MODE];
  mode = m === "on" || m === "off" ? m : undefined;
});

async function isOn(): Promise<boolean> {
  await modeReady;
  return mode === "on";
}

async function saveMode(next: AutoGroupMode) {
  mode = next;
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_GROUP_MODE]: next });
}

// --- state (serialised: every change runs through one queue) ---------------

let state: State | null = null;

async function getState(): Promise<State> {
  if (state) return state;
  const r = await chrome.storage.session.get(STORAGE_KEYS.AUTO_GROUP_STATE);
  const saved = r[STORAGE_KEYS.AUTO_GROUP_STATE] as Partial<State> | undefined;
  state = {
    manual: saved?.manual ?? {},
    placed: saved?.placed ?? {},
    fresh: saved?.fresh ?? {},
    groups: saved?.groups ?? {},
    undo: saved?.undo,
  };
  return state;
}

async function saveState() {
  if (state) await chrome.storage.session.set({ [STORAGE_KEYS.AUTO_GROUP_STATE]: state });
}

let queue: Promise<unknown> = Promise.resolve();
function run<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch((error) => console.warn("[autoGroup]", error));
  return next;
}

// --- telling our changes from the user's ---------------------------------

const ours = new Map<number, number>();
const openedAt = new Map<number, number>();

function markOurs(ids: number[]) {
  const until = Date.now() + OURS_MS;
  for (const id of ids) ours.set(id, until);
}

function isOurs(id: number): boolean {
  const until = ours.get(id);
  return until !== undefined && until > Date.now();
}

// --- reading tabs ------------------------------------------------------------

const isWeb = (url: string) => /^https?:/i.test(url);
const siteKey = (url: string) => siteOf(url)?.site ?? "";

function toPlanTab(tab: chrome.tabs.Tab): PlanTab {
  return {
    id: tab.id ?? -1,
    windowId: tab.windowId,
    index: tab.index,
    groupId: tab.groupId ?? -1,
    url: tab.url ?? tab.pendingUrl ?? "",
    title: tab.title ?? "",
    pinned: tab.pinned,
    lastAccessed: tab.lastAccessed,
    favicon: tab.favIconUrl,
  };
}

const metaCache = new Map<string, PageMeta | null>();

/** Page metadata (site name, description, keywords) — read locally, never stored. */
async function readMeta(tab: chrome.tabs.Tab): Promise<PageMeta | undefined> {
  if (tab.id === undefined || tab.discarded || tab.status !== "complete" || !isWeb(tab.url ?? "")) return undefined;
  const cacheKey = `${tab.id} ${tab.url}`;
  if (metaCache.has(cacheKey)) return metaCache.get(cacheKey) ?? undefined;
  let meta: PageMeta | null;
  try {
    const job = chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const read = (selector: string) =>
          document.querySelector(selector)?.getAttribute("content")?.slice(0, 300) || undefined;
        return {
          siteName: read('meta[property="og:site_name"]') ?? read('meta[name="application-name"]'),
          description: read('meta[name="description"]') ?? read('meta[property="og:description"]'),
          keywords: read('meta[name="keywords"]'),
        };
      },
    });
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 600));
    const res = await Promise.race([job, timeout]);
    meta = res?.[0]?.result ?? null;
  } catch {
    meta = null; // chrome:// pages, the web store, …
  }
  if (metaCache.size > 500) metaCache.clear();
  metaCache.set(cacheKey, meta);
  return meta ?? undefined;
}

/** Adds metadata to loose tabs that their title and address don't place. */
async function withMeta(chromeTabs: chrome.tabs.Tab[], planTabs: PlanTab[], skip: Set<number>) {
  await Promise.all(
    planTabs.map(async (t, i) => {
      if (t.groupId !== -1 || t.pinned || skip.has(t.id) || !isWeb(t.url)) return;
      if (categorize(t)) return;
      const meta = await readMeta(chromeTabs[i]);
      if (meta) t.meta = meta;
    })
  );
}

// --- applying ----------------------------------------------------------------

async function applyPlan(plan: AutoGroupPlan, st: State, tabsById: Map<number, PlanTab>): Promise<ApplyResult> {
  let tabCount = 0;
  let groupCount = 0;
  // Oldest first: each new group goes to the front, so the newest ends up first.
  for (const g of [...plan.groups].reverse()) {
    markOurs(g.tabIds);
    try {
      let groupId = g.groupId;
      if (groupId !== undefined) {
        await addTabsToGroup(g.tabIds, groupId);
      } else {
        groupId = await groupTabsInWindow(g.tabIds, g.title, g.color);
      }
      st.groups[groupId] ??= g.key;
      for (const id of g.tabIds) {
        const tab = tabsById.get(id);
        const category = tab ? categorize(tab) : null;
        st.placed[id] = { key: g.key, site: tab ? siteKey(tab.url) : "", strength: category?.strength ?? "group" };
        delete st.fresh[id];
      }
      tabCount += g.tabIds.length;
      groupCount += 1;
    } catch (error) {
      // A tab closed or moved meanwhile — the next pass picks up the rest.
      console.warn("[autoGroup] could not group", g.title, error);
    }
  }
  return { tabCount, groupCount };
}

/**
 * One window: take changed tabs out of categories they no longer fit, then
 * put every loose tab where it belongs.
 */
async function reconcileWindow(windowId: number, changed: Set<number>): Promise<ApplyResult> {
  const st = await getState();
  let chromeTabs: chrome.tabs.Tab[];
  let groups: chrome.tabGroups.TabGroup[];
  try {
    [chromeTabs, groups] = await Promise.all([
      chrome.tabs.query({ windowId }),
      chrome.tabGroups.query({ windowId }),
    ]);
  } catch {
    return { tabCount: 0, groupCount: 0 }; // window closed
  }
  const tabs = chromeTabs.map(toPlanTab);
  const manual = new Set(Object.keys(st.manual).map(Number));

  const groupKey = new Map<number, string | null>();
  for (const g of groups) {
    groupKey.set(g.id, resolveGroupKey({ id: g.id, windowId, title: g.title ?? "" }, tabs.filter((t) => t.groupId === g.id), st.groups));
  }

  // 1. Tabs we placed (or the browser dropped into a group as they opened)
  //    that now belong somewhere else.
  const leave: number[] = [];
  for (const t of tabs) {
    if (t.groupId === -1 || t.pinned || manual.has(t.id)) continue;
    const isFresh = st.fresh[t.id] !== undefined;
    const placed = st.placed[t.id];
    if (!isFresh && !(placed && changed.has(t.id))) continue;
    if (!isWeb(t.url)) continue; // still on a new-tab page
    const key = groupKey.get(t.groupId);
    if (!key) {
      delete st.fresh[t.id]; // the user's own group — leave it there
      continue;
    }
    const now = groupKeyForTab(t);
    if (now?.key === key) {
      st.placed[t.id] = { key, site: siteKey(t.url), strength: now.category?.strength ?? "group" };
      delete st.fresh[t.id];
      continue;
    }
    leave.push(t.id);
    t.groupId = -1;
    delete st.placed[t.id];
  }
  if (leave.length) {
    markOurs(leave);
    try {
      await ungroupTabs(leave);
    } catch (error) {
      console.warn("[autoGroup] could not ungroup", error);
    }
  }

  // 2. Every loose tab into its category.
  await withMeta(chromeTabs, tabs, manual);
  const plan = planAutoGroups({
    tabs,
    groups: groups.map((g) => ({ id: g.id, windowId, title: g.title ?? "" })),
    manualTabIds: manual,
    knownGroupKeys: st.groups,
  });
  const result = await applyPlan(plan, st, new Map(tabs.map((t) => [t.id, t])));

  // New tabs that loaded and found no group stay loose like any other tab.
  for (const t of tabs) if (isWeb(t.url)) delete st.fresh[t.id];
  await saveState();
  return result;
}

async function allWindowIds(): Promise<number[]> {
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  return windows.map((w) => w.id).filter((id): id is number => id !== undefined);
}

async function reconcileAll(): Promise<ApplyResult> {
  const total = { tabCount: 0, groupCount: 0 };
  for (const id of await allWindowIds()) {
    const r = await reconcileWindow(id, new Set());
    total.tabCount += r.tabCount;
    total.groupCount += r.groupCount;
  }
  return total;
}

// --- debounced work per window ---------------------------------------------

const pending = new Map<number, { timer: ReturnType<typeof setTimeout>; tabs: Set<number> }>();

function schedule(windowId: number, tabId?: number) {
  const entry = pending.get(windowId) ?? { timer: undefined as unknown as ReturnType<typeof setTimeout>, tabs: new Set<number>() };
  clearTimeout(entry.timer);
  if (tabId !== undefined) entry.tabs.add(tabId);
  entry.timer = setTimeout(() => {
    pending.delete(windowId);
    void run(async () => {
      if (await isOn()) await reconcileWindow(windowId, entry.tabs);
    });
  }, SETTLE_MS);
  pending.set(windowId, entry);
}

// --- popup requests ------------------------------------------------------------

async function preview(): Promise<AutoGroupPreview> {
  const st = await getState();
  const [chromeTabs, groups] = await Promise.all([
    chrome.tabs.query({ windowType: "normal" }),
    chrome.tabGroups.query({}),
  ]);
  const tabs = chromeTabs.map(toPlanTab);
  const manual = new Set(Object.keys(st.manual).map(Number));
  await withMeta(chromeTabs, tabs, manual);
  const plan = planAutoGroups({
    tabs,
    groups: groups.map((g) => ({ id: g.id, windowId: g.windowId, title: g.title ?? "" })),
    manualTabIds: manual,
    knownGroupKeys: st.groups,
  });
  const byId = new Map(tabs.map((t) => [t.id, t]));
  const merged = new Map<string, PreviewGroup>();
  for (const g of plan.groups) {
    const entry = merged.get(g.key) ?? {
      key: g.key,
      name: g.name,
      emoji: g.emoji,
      color: g.color,
      count: 0,
      favicons: [],
      titles: [],
      joinsExisting: false,
    };
    entry.count += g.tabIds.length;
    entry.joinsExisting ||= g.groupId !== undefined;
    for (const id of g.tabIds) {
      const t = byId.get(id);
      if (!t) continue;
      if (t.favicon && isWeb(t.favicon) && !entry.favicons.includes(t.favicon) && entry.favicons.length < 3) entry.favicons.push(t.favicon);
      if (t.title && entry.titles.length < 4) entry.titles.push(t.title);
    }
    merged.set(g.key, entry);
  }
  return { groups: [...merged.values()], tabCount: plan.tabCount, keptInGroups: plan.keptInGroups };
}

async function apply(): Promise<ApplyResult> {
  const st = await getState();
  const before = await chrome.tabs.query({ windowType: "normal" });
  await saveMode("on");
  const result = await reconcileAll();
  const placedNow = new Set(Object.keys(st.placed).map(Number));
  st.undo = {
    at: Date.now(),
    tabs: before
      .filter((t) => t.id !== undefined && (t.groupId ?? -1) === -1 && placedNow.has(t.id))
      .map((t) => ({ id: t.id!, windowId: t.windowId, index: t.index })),
  };
  await saveState();
  return result;
}

async function undo(): Promise<boolean> {
  const st = await getState();
  const record = st.undo;
  st.undo = undefined;
  await saveMode("off");
  if (!record || Date.now() - record.at > UNDO_FOR_MS) {
    await saveState();
    return false;
  }
  // Only tabs still open and still in the same window (nothing is moved between windows).
  const windowOf = new Map((await chrome.tabs.query({})).map((t) => [t.id, t.windowId]));
  const tabs = record.tabs.filter((t) => windowOf.get(t.id) === t.windowId);
  const ids = tabs.map((t) => t.id);
  markOurs(ids);
  if (ids.length) await ungroupTabs(ids).catch(() => undefined);
  // Back to their old places: first all to the end of their window (so every
  // other tab is back in its old order), then each to its old index, lowest
  // first — each lands exactly where it was.
  const windows = new Set(tabs.map((t) => t.windowId));
  for (const windowId of windows) {
    const inWindow = tabs.filter((t) => t.windowId === windowId).map((t) => t.id);
    markOurs(inWindow);
    await chrome.tabs.move(inWindow, { windowId, index: -1 }).catch(() => undefined);
  }
  for (const t of [...tabs].sort((a, b) => a.index - b.index)) {
    markOurs([t.id]);
    await chrome.tabs.move(t.id, { windowId: t.windowId, index: t.index }).catch(() => undefined);
    delete st.placed[t.id];
  }
  // A move into the middle of a group joins it — take those back out.
  const stray = (await chrome.tabs.query({})).filter((t) => t.id !== undefined && ids.includes(t.id) && (t.groupId ?? -1) !== -1);
  if (stray.length) {
    markOurs(stray.map((t) => t.id!));
    await ungroupTabs(stray.map((t) => t.id!)).catch(() => undefined);
  }
  await saveState();
  return true;
}

async function handle(request: AutoGroupRequest): Promise<unknown> {
  switch (request.action) {
    case "preview":
      return run(preview);
    case "apply":
      return run(apply);
    case "undo":
      return run(undo);
    case "setMode":
      return run(async () => {
        await saveMode(request.mode);
        if (request.mode === "on") await reconcileAll();
        return true;
      });
  }
}

// --- wiring ----------------------------------------------------------------------

export function registerAutoGroup() {
  if (!chrome.tabGroups?.query) return; // browser without tab groups

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const request = message as AutoGroupRequest | undefined;
    if (request?.type !== AUTO_GROUP_MESSAGE) return false;
    handle(request).then(
      (data) => sendResponse({ ok: true, data }),
      (error: unknown) => sendResponse({ ok: false, error: String(error) })
    );
    return true; // async response
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(STORAGE_KEYS.AUTO_GROUP_MODE in changes)) return;
    const m = changes[STORAGE_KEYS.AUTO_GROUP_MODE].newValue;
    mode = m === "on" || m === "off" ? m : undefined;
  });

  // Restored windows: place whatever came back loose.
  chrome.runtime.onStartup.addListener(() => {
    setTimeout(() => void run(async () => (await isOn()) && reconcileAll()), 4000);
  });

  chrome.tabs.onCreated.addListener((tab) => {
    if (tab.id === undefined) return;
    openedAt.set(tab.id, Date.now());
    void run(async () => {
      if (!(await isOn())) return;
      const st = await getState();
      st.fresh[tab.id!] = Date.now();
      await saveState();
    });
    schedule(tab.windowId, tab.id);
  });

  chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
    if (mode === "off") return;

    if (change.groupId !== undefined) {
      // Decided now — "ours" expires.
      const justOpened = Date.now() - (openedAt.get(tabId) ?? 0) < INHERIT_MS;
      if (!isOurs(tabId) && !justOpened) {
        // The user moved it — leave it where they put it.
        void run(async () => {
          if (!(await isOn())) return;
          const st = await getState();
          st.manual[tabId] = siteKey(tab.url ?? "");
          delete st.placed[tabId];
          delete st.fresh[tabId];
          await saveState();
        });
      }
      return;
    }

    const loose = (tab.groupId ?? -1) === -1;
    if (change.url !== undefined) {
      const site = siteKey(change.url);
      void run(async () => {
        if (!(await isOn())) return;
        const st = await getState();
        const placed = st.placed[tabId];
        const movedSite = (placed && placed.site !== site) || (st.manual[tabId] !== undefined && st.manual[tabId] !== site);
        // A different site ends a manual placement — look at the tab afresh.
        if (st.manual[tabId] !== undefined && st.manual[tabId] !== site) {
          delete st.manual[tabId];
          st.fresh[tabId] = Date.now();
        }
        await saveState();
        if (movedSite || loose || st.fresh[tabId] !== undefined) schedule(tab.windowId, tabId);
      });
      return;
    }

    if (change.title !== undefined || change.status === "complete" || change.pinned === false) {
      void run(async () => {
        if (!(await isOn())) return;
        const st = await getState();
        if (st.manual[tabId] !== undefined) return;
        const placed = st.placed[tabId];
        // Same site, new title: only a keyword-based placement can change.
        if (loose || st.fresh[tabId] !== undefined || placed?.strength === "keyword") schedule(tab.windowId, tabId);
      });
    }
  });

  chrome.tabs.onAttached.addListener((tabId, info) => {
    if (mode !== "off") schedule(info.newWindowId, tabId);
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    openedAt.delete(tabId);
    ours.delete(tabId);
    void run(async () => {
      const st = await getState();
      if (st.manual[tabId] === undefined && st.placed[tabId] === undefined && st.fresh[tabId] === undefined) return;
      delete st.manual[tabId];
      delete st.placed[tabId];
      delete st.fresh[tabId];
      await saveState();
    });
  });

  chrome.tabGroups.onRemoved.addListener((group) => {
    void run(async () => {
      const st = await getState();
      if (st.groups[group.id] === undefined) return;
      delete st.groups[group.id];
      await saveState();
    });
  });
}
