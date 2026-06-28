/**
 * tabStore harness — proves loadTabs() actually fetches tabs (the bug in the
 * screenshot was an empty `loadTabs` stub that left the list at 0).
 */

interface MockTab {
  id: number;
  windowId: number;
  index: number;
  groupId: number;
  title: string;
  url: string;
  pinned?: boolean;
  active?: boolean;
}

const TABS: MockTab[] = [
  { id: 101, windowId: 1, index: 0, groupId: -1, title: "Tab A", url: "https://a.com", active: true },
  { id: 102, windowId: 1, index: 1, groupId: -1, title: "Tab B", url: "https://b.com", pinned: true },
  { id: 103, windowId: 1, index: 2, groupId: -1, title: "Tab C", url: "https://c.com" },
  { id: 201, windowId: 2, index: 0, groupId: -1, title: "Other window tab", url: "https://x.com" },
];

interface MockGroup {
  id: number;
  windowId: number;
  title?: string;
  color: string;
  collapsed: boolean;
}

const GROUPS: MockGroup[] = [];
let nextGroupId = 10;

const ACTIVATED: { tabId?: number; windowId?: number } = {};
const STORAGE: Record<string, unknown> = {};

function refreshIndexes() {
  for (const windowId of new Set(TABS.map((tab) => tab.windowId))) {
    TABS.filter((tab) => tab.windowId === windowId).forEach(
      (tab, index) => {
        tab.index = index;
      }
    );
  }
}

(globalThis as unknown as { chrome: unknown }).chrome = {
  tabs: {
    query: async (q: { windowId?: number }) =>
      q.windowId === undefined
        ? TABS
        : TABS.filter((t) => t.windowId === q.windowId),
    remove: async (ids: number[]) => {
      for (const id of ids) {
        const i = TABS.findIndex((t) => t.id === id);
        if (i >= 0) TABS.splice(i, 1);
      }
    },
    update: async (tabId: number) => {
      ACTIVATED.tabId = tabId;
    },
    get: async (tabId: number) =>
      TABS.find((tab) => tab.id === tabId),
    group: async ({
      tabIds,
      groupId,
    }: {
      tabIds: number | number[];
      groupId?: number;
    }) => {
      const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
      const targetId = groupId ?? nextGroupId++;

      if (groupId === undefined) {
        const firstTab = TABS.find((tab) => ids.includes(tab.id));
        GROUPS.push({
          id: targetId,
          windowId: firstTab?.windowId ?? 1,
          title: "",
          color: "grey",
          collapsed: false,
        });
      }

      for (const tab of TABS) {
        if (ids.includes(tab.id)) {
          tab.groupId = targetId;
        }
      }

      return targetId;
    },
    ungroup: async (tabIds: number | number[]) => {
      const ids = Array.isArray(tabIds) ? tabIds : [tabIds];

      for (const tab of TABS) {
        if (ids.includes(tab.id)) {
          tab.groupId = -1;
        }
      }

      for (let index = GROUPS.length - 1; index >= 0; index--) {
        if (!TABS.some((tab) => tab.groupId === GROUPS[index].id)) {
          GROUPS.splice(index, 1);
        }
      }
    },
    move: async (
      tabIds: number | number[],
      properties: { index?: number; windowId?: number }
    ) => {
      const ids = Array.isArray(tabIds) ? tabIds : [tabIds];
      const moved = ids
        .map((id) => TABS.find((tab) => tab.id === id))
        .filter((tab): tab is MockTab => Boolean(tab));

      for (const tab of moved) {
        TABS.splice(TABS.indexOf(tab), 1);

        if (properties.windowId !== undefined) {
          tab.windowId = properties.windowId;
        }
      }

      refreshIndexes();

      const windowId = moved[0]?.windowId;
      const windowTabs = TABS.filter(
        (tab) => tab.windowId === windowId
      );
      const target =
        properties.index === -1
          ? undefined
          : windowTabs[properties.index ?? 0];
      const insertionIndex = target
        ? TABS.indexOf(target)
        : TABS.length;

      TABS.splice(insertionIndex, 0, ...moved);
      refreshIndexes();

      return Array.isArray(tabIds) ? moved : moved[0];
    },
  },
  tabGroups: {
    query: async ({ windowId }: { windowId?: number }) =>
      GROUPS.filter(
        (group) =>
          windowId === undefined || group.windowId === windowId
      ),
    update: async (
      groupId: number,
      updates: Partial<MockGroup>
    ) => {
      const group = GROUPS.find((item) => item.id === groupId);
      Object.assign(group ?? {}, updates);
      return group;
    },
    move: async (groupId: number) =>
      GROUPS.find((group) => group.id === groupId),
  },
  windows: {
    getAll: async () => [],
    update: async (windowId: number) => {
      ACTIVATED.windowId = windowId;
    },
  },
  storage: {
    local: {
      get: async (key: string) => ({
        [key]: STORAGE[key],
      }),
      set: async (updates: Record<string, unknown>) => {
        Object.assign(STORAGE, updates);
      },
      remove: async (key: string) => {
        delete STORAGE[key];
      },
    },
  },
};

const { useTabStore } = await import(
  "../src/stores/tabStore"
);

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

async function run() {
  console.log("TAB STORE HARNESS");

  const store = useTabStore.getState();

  // Before: empty (this is what the screenshot showed).
  check("starts empty", store.tabs.length === 0);

  // loadTabs for window 1 should pull exactly window 1's tabs.
  await useTabStore.getState().loadTabs(1);
  let s = useTabStore.getState();
  check(
    "loadTabs(1) populates 3 tabs",
    s.tabs.length === 3,
    `got ${s.tabs.length}`
  );
  check("loadTabs records currentWindowId", s.currentWindowId === 1);
  check(
    "does not leak window 2's tab",
    !s.tabs.some((t) => t.id === 201)
  );

  // Favorite flow is URL-backed, so it survives a popup/store reload.
  await useTabStore.getState().toggleFavorite(102);
  s = useTabStore.getState();
  check(
    "toggleFavorite marks the tab",
    s.tabs.find((tab) => tab.id === 102)?.favorite === true
  );
  check(
    "favorite URL is persisted",
    Array.isArray(STORAGE.favoriteTabs) &&
      STORAGE.favoriteTabs.includes("https://b.com")
  );

  await useTabStore.getState().loadTabs(1);
  s = useTabStore.getState();
  check(
    "favorite survives reloading tabs",
    s.tabs.find((tab) => tab.id === 102)?.favorite === true
  );

  // Native Chrome tab group flow.
  useTabStore.getState().toggleSelectionMode();
  useTabStore.getState().toggleTabSelection(101);
  useTabStore.getState().toggleTabSelection(102);
  await useTabStore.getState().groupSelectedTabs();
  s = useTabStore.getState();
  const groupId = s.groups[0]?.id;
  check("groupSelectedTabs creates a group", s.groups.length === 1);
  check(
    "selected tabs are assigned to the group",
    s.tabs
      .filter((tab) => [101, 102].includes(tab.id))
      .every((tab) => tab.groupId === groupId)
  );

  await useTabStore.getState().toggleGroupCollapsed(groupId!);
  check(
    "collapse is reflected in Chrome group state",
    GROUPS[0]?.collapsed === true
  );

  await useTabStore.getState().renameGroup(groupId!, "Research");
  await useTabStore.getState().updateGroupEmoji(groupId!, "🧠");
  await useTabStore.getState().updateGroupColor(groupId!, "blue");
  check(
    "rename and emoji update the native title",
    GROUPS[0]?.title === "🧠 Research"
  );
  check(
    "color updates the native group",
    GROUPS[0]?.color === "blue"
  );

  await useTabStore.getState().moveTabBefore(102, 101);
  check(
    "drag reorder moves a tab before its target",
    TABS.find((tab) => tab.id === 102)!.index <
      TABS.find((tab) => tab.id === 101)!.index
  );

  await useTabStore.getState().shuffleGroupTabs(groupId!);
  check(
    "shuffle keeps every tab in its native group",
    TABS.filter((tab) => [101, 102].includes(tab.id)).every(
      (tab) => tab.groupId === groupId
    )
  );

  await useTabStore.getState().ungroupGroup(groupId!);
  s = useTabStore.getState();
  check("ungroup removes the empty group", s.groups.length === 0);

  // Selection + close flow.
  useTabStore.getState().toggleSelectionMode();
  useTabStore.getState().toggleTabSelection(103);
  s = useTabStore.getState();
  check("tab 103 selected", s.selectedTabs.includes(103));

  await useTabStore.getState().closeSelectedTabs();
  s = useTabStore.getState();
  check(
    "closeSelectedTabs removes the tab + reloads",
    s.tabs.length === 2 && !s.tabs.some((t) => t.id === 103),
    `got ${s.tabs.length}`
  );
  check("selection cleared after close", s.selectedTabs.length === 0);

  // Clicking a tab (non-selection mode) switches to it: activate + focus window.
  useTabStore.getState().toggleSelectionMode(); // exit selection mode
  await useTabStore.getState().activateTab(102);
  check(
    "activateTab activates the right tab",
    ACTIVATED.tabId === 102,
    `got ${ACTIVATED.tabId}`
  );
  check(
    "activateTab focuses the tab's window",
    ACTIVATED.windowId === 1,
    `got ${ACTIVATED.windowId}`
  );

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
