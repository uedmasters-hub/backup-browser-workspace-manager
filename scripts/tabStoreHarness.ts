/**
 * tabStore + tab-sort harness (merged implementation).
 * Verifies preserved tab behaviors: URL-based favorite persistence,
 * favorites annotated on load, switch-to-tab, close, safe tabGroups detection,
 * and favorites-first sorting across modes.
 */

const ACTIVATED: { tabId?: number; windowId?: number; muted?: boolean } = {};
const STORE: Record<string, unknown> = {
  favoriteTabs: ["https://b.com"],
};

interface MockTab {
  id: number;
  windowId: number;
  index: number;
  title: string;
  url: string;
  pinned?: boolean;
  active?: boolean;
}

const TABS: MockTab[] = [
  { id: 101, windowId: 1, index: 0, title: "Tab A", url: "https://a.com", active: true },
  { id: 102, windowId: 1, index: 1, title: "Tab B", url: "https://b.com", pinned: true },
  { id: 103, windowId: 1, index: 2, title: "Tab C", url: "https://c.com" },
  { id: 201, windowId: 2, index: 0, title: "Other window tab", url: "https://x.com" },
];

(globalThis as unknown as { chrome: unknown }).chrome = {
  tabs: {
    query: async (q: { windowId?: number }) =>
      q.windowId === undefined ? TABS : TABS.filter((t) => t.windowId === q.windowId),
    remove: async (ids: number[]) => {
      for (const id of ids) {
        const i = TABS.findIndex((t) => t.id === id);
        if (i >= 0) TABS.splice(i, 1);
      }
    },
    update: async (tabId: number, info?: { muted?: boolean }) => {
      ACTIVATED.tabId = tabId;
      if (info && typeof info.muted === "boolean") {
        ACTIVATED.muted = info.muted;
      }
    },
  },
  windows: {
    getAll: async () => [],
    update: async (windowId: number) => {
      ACTIVATED.windowId = windowId;
    },
  },
  storage: {
    local: {
      get: async (key: string) => (key in STORE ? { [key]: STORE[key] } : {}),
      set: async (obj: Record<string, unknown>) => {
        Object.assign(STORE, obj);
      },
      remove: async (key: string) => {
        delete STORE[key];
      },
    },
  },
  // Intentionally NO chrome.tabGroups -> exercises safe capability detection.
};

import { useTabStore } from "../src/stores/tabStore";
import { sortTabs } from "../src/stores/selectors/tabSelectors";
import type { WorkspaceTab } from "../src/types/tab";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    console.log(`  \u2717 ${label}${detail ? ` -> ${detail}` : ""}`);
  }
}

function tab(partial: Partial<WorkspaceTab>): WorkspaceTab {
  return {
    id: 0, windowId: 1, index: 0, groupId: -1, title: "", url: "",
    favorite: false, pinned: false, active: false, audible: false, discarded: false,
    ...partial,
  };
}

async function run() {
  console.log("TAB STORE + SORT HARNESS");

  await useTabStore.getState().loadTabs(1);
  let s = useTabStore.getState();
  check("loadTabs populates window 1 tabs", s.tabs.length === 3, `got ${s.tabs.length}`);
  check("currentWindowId recorded", s.currentWindowId === 1);
  check("safe tabGroups detection yields []", Array.isArray(s.groups) && s.groups.length === 0);
  check("seeded favorite annotated on load (URL-based)", s.tabs.find((t) => t.id === 102)?.favorite === true);
  check("non-favorite tab not marked", s.tabs.find((t) => t.id === 103)?.favorite === false);

  await useTabStore.getState().toggleFavorite(103);
  s = useTabStore.getState();
  check("toggleFavorite marks the tab", s.tabs.find((t) => t.id === 103)?.favorite === true);
  check("favorite persisted by URL", (STORE.favoriteTabs as string[]).includes("https://c.com"), JSON.stringify(STORE.favoriteTabs));

  await useTabStore.getState().loadTabs(1);
  s = useTabStore.getState();
  check("favorite survives reload (persistence)", s.tabs.find((t) => t.id === 103)?.favorite === true);

  await useTabStore.getState().activateTab(101);
  check("activateTab activates correct tab", ACTIVATED.tabId === 101, `got ${ACTIVATED.tabId}`);
  check("activateTab focuses the window", ACTIVATED.windowId === 1);

  useTabStore.getState().toggleSelectionMode();
  useTabStore.getState().toggleTabSelection(101);
  await useTabStore.getState().closeSelectedTabs();
  s = useTabStore.getState();
  check("closeSelectedTabs removes tab + reloads", !s.tabs.some((t) => t.id === 101));

  const sample: WorkspaceTab[] = [
    tab({ id: 1, title: "Zebra", url: "https://z", favorite: false, lastAccessed: 100 }),
    tab({ id: 2, title: "Apple", url: "https://a", favorite: true, lastAccessed: 1 }),
    tab({ id: 3, title: "Mango", url: "https://m", favorite: false, lastAccessed: 200, pinned: true }),
  ];
  for (const mode of ["newest", "oldest", "title-asc", "title-desc", "pinned", "favorites"] as const) {
    const sorted = sortTabs(sample, mode);
    check(`favorites pinned first in "${mode}" mode`, sorted[0].favorite === true, sorted.map((t) => t.title).join(","));
  }

  // toggle mute on a media tab
  await useTabStore.getState().loadTabs(1);
  const firstId = useTabStore.getState().tabs[0]?.id;
  if (typeof firstId === "number") {
    await useTabStore.getState().toggleMuteTab(firstId);
    check("toggleMuteTab calls tabs.update with muted=true", ACTIVATED.muted === true);
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
