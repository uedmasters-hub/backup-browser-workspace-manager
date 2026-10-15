/**
 * Auto Group Tabs — the background side. Owns every change it makes to tab
 * groups so it can tell its own moves from the user's.
 *
 * Flow:
 *  1. Set-up (from the header icon): "preview" indexes every open tab and
 *     suggests groups — nothing moves. The user reviews and unchecks any
 *     group they don't want.
 *  2. "apply" groups the loose tabs (minus unchecked groups, which are
 *     remembered), turns auto-grouping on, and can be undone.
 *  3. While on, new tabs and tabs that move to another site are placed as
 *     they load, a window at a time, a moment after things settle.
 *
 * Progress (indexing / grouping) is broadcast so an open popup can show it.
 *
 * Respecting the user:
 *  - A tab moved by hand (into a group, out of one, between groups) is left
 *    alone until it goes to a different site.
 *  - Never touched: pinned tabs, tabs in the user's own groups, groups the
 *    user unchecked, and nothing moves between windows.
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
  AUTO_GROUP_PROGRESS,
  type ApplyResult,
  type AutoGroupMode,
  type AutoGroupPreview,
  type AutoGroupProgress,
  type AutoGroupProgressMessage,
  type AutoGroupRequest,
  type AutoGroupStatus,
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
  lastResult?: ApplyResult;
}

const SETTLE_MS = 700;
/** A group change right after a tab opens is the browser's (link opened from a grouped tab). */
const INHERIT_MS = 3000;
const OURS_MS = 4000;
const UNDO_FOR_MS = 30 * 60_000;
const META_TIMEOUT_MS = 600;
const PREVIEW_TABS_PER_GROUP = 40;

const emptyResult = (): ApplyResult => ({ tabCount: 0, groupCount: 0, errors: [] });
const errorText = (error: unknown) => String((error as Error)?.message ?? error);

// --- settings -----------------------------------------------------------------

let mode: AutoGroupMode | undefined;
let excluded = new Set<string>();

const settingsReady = chrome.storage.local
  .get([STORAGE_KEYS.AUTO_GROUP_MODE, STORAGE_KEYS.AUTO_GROUP_EXCLUDED])
  .then((r) => {
    const m = r[STORAGE_KEYS.AUTO_GROUP_MODE];
    mode = m === "on" || m === "off" ? m : undefined;
    const list = r[STORAGE_KEYS.AUTO_GROUP_EXCLUDED];
    excluded = new Set(Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : []);
  })
  .catch((error) => console.warn("[autoGroup] settings", error));

async function isOn(): Promise<boolean> {
  await settingsReady;
  return mode === "on";
}

async function saveMode(next: AutoGroupMode) {
  mode = next;
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_GROUP_MODE]: next });
}

async function saveExcluded(next: Set<string>) {
  excluded = next;
  await chrome.storage.local.set({ [STORAGE_KEYS.AUTO_GROUP_EXCLUDED]: [...next].slice(0, 200) });
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
    lastResult: saved?.lastResult,
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

// --- progress ----------------------------------------------------------------

let progress: AutoGroupProgress | null = null;
let lastSent = 0;

function broadcast() {
  const message: AutoGroupProgressMessage = { type: AUTO_GROUP_PROGRESS, progress };
  // No popup open → nobody listening; that's fine.
  chrome.runtime.sendMessage(message).catch(() => undefined);
}

function report(next: AutoGroupProgress | null) {
  progress = next;
  const now = Date.now();
  // Start, finish and every step of a small job are sent; big jobs ~15×/s.
  if (!next || next.done === 0 || next.done === next.total || now - lastSent > 66) {
    lastSent = now;
    broadcast();
  }
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
    job.catch(() => undefined); // may settle after the timeout
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), META_TIMEOUT_MS));
    const res = await Promise.race([job, timeout]);
    meta = res?.[0]?.result ?? null;
  } catch {
    meta = null; // browser pages, the web store, …
  }
  if (metaCache.size > 500) metaCache.clear();
  metaCache.set(cacheKey, meta);
  return meta ?? undefined;
}

/**
 * Index tabs: loose tabs that their address and title don't place get their
 * page metadata too. `onIndexed` ticks once per tab.
 */
async function indexTabs(
  chromeTabs: chrome.tabs.Tab[],
  planTabs: PlanTab[],
  skip: Set<number>,
  onIndexed?: () => void
) {
  await Promise.all(
    planTabs.map(async (t, i) => {
      try {
        if (t.groupId !== -1 || t.pinned || skip.has(t.id) || !isWeb(t.url) || categorize(t)) return;
        const meta = await readMeta(chromeTabs[i]);
        if (meta) t.meta = meta;
      } finally {
        onIndexed?.();
      }
    })
  );
}

// --- applying ----------------------------------------------------------------

async function applyPlan(
  plan: AutoGroupPlan,
  st: State,
  tabsById: Map<number, PlanTab>,
  result: ApplyResult,
  onGroup?: () => void
) {
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
      result.tabCount += g.tabIds.length;
      result.groupCount += 1;
    } catch (error) {
      // A tab closed or moved meanwhile — the next pass picks up the rest.
      console.warn("[autoGroup] could not group", g.title, error);
      if (result.errors.length < 5) result.errors.push(`${g.name}: ${errorText(error)}`);
    }
    onGroup?.();
  }
}

interface Prepared {
  plan: AutoGroupPlan;
  tabs: PlanTab[];
}

/**
 * One window, nothing grouped yet: take changed tabs out of categories they
 * no longer fit, then plan where every loose tab belongs.
 */
async function prepareWindow(windowId: number, changed: Set<number>, st: State): Promise<Prepared | null> {
  let chromeTabs: chrome.tabs.Tab[];
  let groups: chrome.tabGroups.TabGroup[];
  try {
    [chromeTabs, groups] = await Promise.all([
      chrome.tabs.query({ windowId }),
      chrome.tabGroups.query({ windowId }),
    ]);
  } catch {
    return null; // window closed
  }
  const tabs = chromeTabs.map(toPlanTab);
  const manual = new Set(Object.keys(st.manual).map(Number));

  const groupKey = new Map<number, string | null>();
  for (const g of groups) {
    groupKey.set(g.id, resolveGroupKey({ id: g.id, windowId, title: g.title ?? "" }, tabs.filter((t) => t.groupId === g.id), st.groups));
  }

  // Tabs we placed (or the browser dropped into a group as they opened)
  // that now belong somewhere else.
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

  await indexTabs(chromeTabs, tabs, manual);
  const plan = planAutoGroups({
    tabs,
    groups: groups.map((g) => ({ id: g.id, windowId, title: g.title ?? "" })),
    manualTabIds: manual,
    knownGroupKeys: st.groups,
    excludeKeys: excluded,
  });

  // New tabs that loaded and found no group stay loose like any other tab.
  for (const t of tabs) if (isWeb(t.url) && !plan.groups.some((g) => g.tabIds.includes(t.id))) delete st.fresh[t.id];
  return { plan, tabs };
}

async function windowIds(): Promise<number[]> {
  const windows = await chrome.windows.getAll({ windowTypes: ["normal"] });
  return windows.map((w) => w.id).filter((id): id is number => id !== undefined);
}

/** Plan the given windows, then group — reporting progress when there's work. */
async function reconcile(targets: Array<{ windowId: number; changed: Set<number> }>): Promise<ApplyResult> {
  const st = await getState();
  const prepared: Prepared[] = [];
  for (const { windowId, changed } of targets) {
    const p = await prepareWindow(windowId, changed, st);
    if (p) prepared.push(p);
  }
  const total = prepared.reduce((n, p) => n + p.plan.groups.length, 0);
  const result = emptyResult();
  if (total > 0) {
    let done = 0;
    report({ phase: "grouping", done, total });
    for (const p of prepared) {
      await applyPlan(p.plan, st, new Map(p.tabs.map((t) => [t.id, t])), result, () =>
        report({ phase: "grouping", done: ++done, total })
      );
    }
    report(null);
  }
  await saveState();
  return result;
}

async function reconcileAll(): Promise<ApplyResult> {
  return reconcile((await windowIds()).map((windowId) => ({ windowId, changed: new Set<number>() })));
}

// --- debounced work per window ---------------------------------------------

const pending = new Map<number, { timer?: ReturnType<typeof setTimeout>; tabs: Set<number> }>();

function schedule(windowId: number, tabId?: number) {
  const entry = pending.get(windowId) ?? { tabs: new Set<number>() };
  clearTimeout(entry.timer);
  if (tabId !== undefined) entry.tabs.add(tabId);
  entry.timer = setTimeout(() => {
    pending.delete(windowId);
    void run(async () => {
      if (await isOn()) await reconcile([{ windowId, changed: entry.tabs }]);
    });
  }, SETTLE_MS);
  pending.set(windowId, entry);
}

// --- popup requests ------------------------------------------------------------

async function status(): Promise<AutoGroupStatus> {
  await settingsReady;
  const st = await getState();
  return {
    mode,
    progress,
    canUndo: Boolean(st.undo && Date.now() - st.undo.at < UNDO_FOR_MS),
    lastResult: st.lastResult ?? null,
  };
}

/** Index every open tab and suggest groups. Nothing moves. */
async function preview(): Promise<AutoGroupPreview> {
  await settingsReady;
  const st = await getState();
  const [chromeTabs, groups] = await Promise.all([
    chrome.tabs.query({ windowType: "normal" }),
    chrome.tabGroups.query({}),
  ]);
  const tabs = chromeTabs.map(toPlanTab);
  const manual = new Set(Object.keys(st.manual).map(Number));

  let done = 0;
  const total = tabs.length;
  report({ phase: "indexing", done, total });
  try {
    await indexTabs(chromeTabs, tabs, manual, () => report({ phase: "indexing", done: ++done, total }));
  } finally {
    report(null);
  }

  // Everything, including groups unchecked last time (shown unchecked).
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
      tabs: [],
      joinsExisting: false,
      excluded: excluded.has(g.key),
    };
    entry.count += g.tabIds.length;
    entry.joinsExisting ||= g.groupId !== undefined;
    for (const id of g.tabIds) {
      const t = byId.get(id);
      if (!t || entry.tabs.length >= PREVIEW_TABS_PER_GROUP) continue;
      entry.tabs.push({ id, title: t.title || t.url, favicon: t.favicon && isWeb(t.favicon) ? t.favicon : undefined });
    }
    merged.set(g.key, entry);
  }
  return {
    groups: [...merged.values()],
    tabCount: plan.tabCount,
    indexed: total,
    keptInGroups: plan.keptInGroups,
  };
}

async function apply(include: string[], exclude: string[]): Promise<ApplyResult> {
  await settingsReady;
  const st = await getState();
  const nextExcluded = new Set(excluded);
  for (const key of include) nextExcluded.delete(key);
  for (const key of exclude) nextExcluded.add(key);
  await saveExcluded(nextExcluded);

  const before = await chrome.tabs.query({ windowType: "normal" });
  await saveMode("on");
  const placedBefore = new Set(Object.keys(st.placed).map(Number));
  const result = await reconcileAll();
  const placedNow = Object.keys(st.placed).map(Number).filter((id) => !placedBefore.has(id));
  const wasLoose = new Map(before.filter((t) => t.id !== undefined && (t.groupId ?? -1) === -1).map((t) => [t.id!, t]));
  st.undo = {
    at: Date.now(),
    tabs: placedNow
      .map((id) => wasLoose.get(id))
      .filter((t): t is chrome.tabs.Tab => t !== undefined)
      .map((t) => ({ id: t.id!, windowId: t.windowId, index: t.index })),
  };
  st.lastResult = result;
  await saveState();
  return result;
}

async function undo(): Promise<boolean> {
  const st = await getState();
  const record = st.undo;
  st.undo = undefined;
  st.lastResult = undefined;
  await saveMode("off");
  if (!record || Date.now() - record.at > UNDO_FOR_MS) {
    await saveState();
    return false;
  }
  // Only tabs still open and still in the same window (nothing is moved between windows).
  const open = await chrome.tabs.query({});
  const windowOf = new Map(open.map((t) => [t.id, t.windowId]));
  const tabs = record.tabs.filter((t) => windowOf.get(t.id) === t.windowId);
  // Also tabs placed automatically since — they simply leave their group.
  const later = open
    .filter((t) => t.id !== undefined && st.placed[t.id] !== undefined && (t.groupId ?? -1) !== -1)
    .map((t) => t.id!)
    .filter((id) => !tabs.some((t) => t.id === id));
  for (const id of later) delete st.placed[id];
  const ids = [...tabs.map((t) => t.id), ...later];
  report({ phase: "grouping", done: 0, total: Math.max(1, ids.length) });
  try {
    markOurs(ids);
    if (ids.length) await ungroupTabs(ids).catch(() => undefined);
    // Back to their old places: first all to the end of their window (so every
    // other tab is back in its old order), then each to its old index, lowest
    // first — each lands exactly where it was.
    for (const windowId of new Set(tabs.map((t) => t.windowId))) {
      const inWindow = tabs.filter((t) => t.windowId === windowId).map((t) => t.id);
      markOurs(inWindow);
      await chrome.tabs.move(inWindow, { windowId, index: -1 }).catch(() => undefined);
    }
    let done = 0;
    for (const t of [...tabs].sort((a, b) => a.index - b.index)) {
      markOurs([t.id]);
      await chrome.tabs.move(t.id, { windowId: t.windowId, index: t.index }).catch(() => undefined);
      delete st.placed[t.id];
      report({ phase: "grouping", done: ++done, total: tabs.length });
    }
    // A move into the middle of a group joins it — take those back out.
    const stray = (await chrome.tabs.query({})).filter((t) => t.id !== undefined && ids.includes(t.id) && (t.groupId ?? -1) !== -1);
    if (stray.length) {
      markOurs(stray.map((t) => t.id!));
      await ungroupTabs(stray.map((t) => t.id!)).catch(() => undefined);
    }
  } finally {
    report(null);
  }
  await saveState();
  return true;
}

async function handle(request: AutoGroupRequest): Promise<unknown> {
  switch (request.action) {
    case "status":
      return status(); // not queued — answers while work is running
    case "preview":
      return run(preview);
    case "apply":
      return run(() => apply(request.include ?? [], request.exclude ?? []));
    case "undo":
      return run(undo);
    case "setMode":
      return run(async () => {
        await saveMode(request.mode);
        if (request.mode === "on") {
          const st = await getState();
          st.lastResult = await reconcileAll();
          await saveState();
        }
        return true;
      });
  }
}

// --- wiring ----------------------------------------------------------------------

/** One missing browser API must not take the others down. */
function listen(name: string, add: () => void) {
  try {
    add();
  } catch (error) {
    console.warn(`[autoGroup] couldn't listen to ${name}`, error);
  }
}

export function registerAutoGroup() {
  // Requests first, so the popup always gets an answer (even "unsupported").
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const request = message as AutoGroupRequest | undefined;
    if (request?.type !== AUTO_GROUP_MESSAGE) return false;
    if (!chrome.tabGroups?.query) {
      sendResponse({ ok: false, error: "This browser doesn't let extensions manage tab groups." });
      return false;
    }
    handle(request).then(
      (data) => sendResponse({ ok: true, data }),
      (error: unknown) => sendResponse({ ok: false, error: errorText(error) })
    );
    return true; // async response
  });

  if (!chrome.tabGroups?.query) return; // browser without tab groups

  listen("storage", () =>
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (STORAGE_KEYS.AUTO_GROUP_MODE in changes) {
        const m = changes[STORAGE_KEYS.AUTO_GROUP_MODE].newValue;
        mode = m === "on" || m === "off" ? m : undefined;
      }
      if (STORAGE_KEYS.AUTO_GROUP_EXCLUDED in changes) {
        const list = changes[STORAGE_KEYS.AUTO_GROUP_EXCLUDED].newValue;
        excluded = new Set(Array.isArray(list) ? list : []);
      }
    })
  );

  // Restored windows: place whatever came back loose.
  listen("startup", () =>
    chrome.runtime.onStartup.addListener(() => {
      setTimeout(() => void run(async () => (await isOn()) && reconcileAll()), 4000);
    })
  );

  listen("tabs.onCreated", () =>
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
    })
  );

  listen("tabs.onUpdated", () =>
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
    })
  );

  listen("tabs.onAttached", () =>
    chrome.tabs.onAttached.addListener((tabId, info) => {
      if (mode !== "off") schedule(info.newWindowId, tabId);
    })
  );

  listen("tabs.onRemoved", () =>
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
    })
  );

  listen("tabGroups.onRemoved", () =>
    chrome.tabGroups.onRemoved.addListener((group) => {
      void run(async () => {
        const st = await getState();
        if (st.groups[group.id] === undefined) return;
        delete st.groups[group.id];
        await saveState();
      });
    })
  );
}
