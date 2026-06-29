/**
 * Backup harness: exercises collectBackup, buildTabsHtml and importBackup
 * (raw JSON + zipped) against a mocked chrome.* surface.
 */
import { zipStore, strToU8 } from "../src/browser/backup/zip";

let store: Record<string, unknown> = {
  workspaceNotes: [{ id: "n1", title: "Note", blocks: [] }],
  favoriteTabs: ["https://a.com/"],
  tabSortMode: "favorites",
  lastSyncedAt: 123,
  workspaces: [
    {
      chromeWindowId: 1,
      name: "My WS",
      emoji: "🚀",
      color: "#000",
      archived: true,
    },
  ],
};

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (keys: unknown) =>
        keys === null ? { ...store } : {},
      set: async (obj: Record<string, unknown>) => {
        store = { ...store, ...obj };
      },
    },
  },
  windows: {
    create: async () => ({ id: 0, tabs: [] }),
    getAll: async () => [
      {
        id: 1,
        focused: true,
        tabs: [
          {
            id: 11,
            title: "Alpha",
            url: "https://a.com/",
            favIconUrl: "",
            pinned: false,
            groupId: 5,
            index: 0,
          },
          {
            id: 12,
            title: "Beta",
            url: "https://b.com/",
            pinned: true,
            groupId: -1,
            index: 1,
          },
        ],
      },
    ],
  },
  tabGroups: {
    query: async () => [
      { id: 5, title: "Work", color: "blue", collapsed: false },
    ],
    update: async () => undefined,
  },
  tabs: {
    update: async () => undefined,
    group: async () => 0,
  },
};

import {
  collectBackup,
  buildTabsHtml,
  importBackup,
  BACKUP_APP,
} from "../src/browser/backup/backupService";

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, info = "") {
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${info ? ` -> ${info}` : ""}`);
  }
}

type FileLike = {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function fileFrom(name: string, bytes: Uint8Array): FileLike {
  return {
    name,
    arrayBuffer: async () =>
      bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ),
  };
}

async function run() {
  const backup = await collectBackup();

  check("app + version stamped", backup.app === BACKUP_APP);
  check(
    "settings dumped from storage",
    backup.settings.tabSortMode === "favorites" &&
      Array.isArray(backup.settings.workspaceNotes)
  );
  check("one window snapshot", backup.windows.length === 1);
  check("two tabs captured", backup.windows[0].tabs.length === 2);
  check(
    "workspace name + archive mapped",
    backup.windows[0].name === "My WS" && backup.windows[0].archived
  );
  const alpha = backup.windows[0].tabs.find((t) => t.url === "https://a.com/");
  check("favorite flag from favoriteTabs", Boolean(alpha?.favorite));
  check("grouped tab keeps groupId", alpha?.groupId === 5);
  check(
    "group metadata captured",
    backup.windows[0].groups.some((g) => g.title === "Work")
  );

  const html = buildTabsHtml(backup);
  check("html is standalone", html.startsWith("<!doctype html>"));
  check("html links the tab url", html.includes('href="https://a.com/"'));
  check("html shows group name", html.includes("Work"));
  check("html marks archived window", html.includes("Archived"));
  check("html stars a favorite", html.includes("★"));

  // ---- full restore (recreate windows/tabs/pins/groups) ----
  type ChromeMut = {
    windows: {
      create: (info: { url: string[] }) => Promise<{
        id: number;
        tabs: { id: number; index: number }[];
      }>;
    };
    tabs: {
      update: (id: number, info: { pinned?: boolean }) => Promise<unknown>;
      group: (arg: {
        tabIds: number[];
        createProperties?: { windowId: number };
      }) => Promise<number>;
    };
    tabGroups: {
      query: () => Promise<unknown[]>;
      update: (id: number, info: { title?: string }) => Promise<unknown>;
    };
  };
  const C = (globalThis as unknown as { chrome: ChromeMut }).chrome;

  const pinned: number[] = [];
  const grouped: number[] = [];
  let groupTitle = "";
  C.windows.create = async ({ url }) => ({
    id: 100,
    tabs: url.map((_u, i) => ({ id: 1000 + i, index: i })),
  });
  C.tabs.update = async (id, info) => {
    if (info.pinned) {
      pinned.push(id);
    }
    return undefined;
  };
  C.tabs.group = async ({ tabIds }) => {
    grouped.push(...tabIds);
    return 500;
  };
  C.tabGroups.update = async (_id: number, info: { title?: string }) => {
    groupTitle = info.title ?? "";
    return undefined;
  };

  const json = JSON.stringify(backup);

  // restore via raw JSON
  store = {};
  const sum = await importBackup(
    fileFrom("backup.json", strToU8(json)) as unknown as File
  );
  check("restore opens one window", sum.windows === 1);
  check("restore opens both tabs", sum.tabs === 2);
  check("restore rebuilds the group", sum.groups === 1 && groupTitle === "Work");
  check("restore pins the pinned tab", pinned.includes(1001));
  check("restore groups the grouped tab", grouped.includes(1000));
  check("settings restored (sort)", store.tabSortMode === "favorites");
  check("favorites restored", Array.isArray(store.favoriteTabs));
  const ws = store.workspaces as Array<Record<string, unknown>> | undefined;
  check(
    "workspace metadata remapped to new window id",
    Array.isArray(ws) &&
      ws[0]?.chromeWindowId === 100 &&
      ws[0]?.name === "My WS" &&
      ws[0]?.archived === true
  );

  // restore via zip
  store = {};
  pinned.length = 0;
  const zip = zipStore({ "backup.json": strToU8(json) });
  const sumZip = await importBackup(
    fileFrom("bwm.zip", zip) as unknown as File
  );
  check("restore from zip works", sumZip.windows === 1 && sumZip.tabs === 2);

  // restricted-scheme tabs are skipped, not opened
  const restricted = {
    ...backup,
    windows: [
      {
        chromeWindowId: 9,
        name: "Sys",
        archived: false,
        focused: false,
        groups: [],
        tabs: [
          {
            title: "New Tab",
            url: "chrome://newtab/",
            pinned: false,
            groupId: -1,
            index: 0,
            favorite: false,
          },
        ],
      },
    ],
  };
  const sumR = await importBackup(
    fileFrom(
      "r.json",
      strToU8(JSON.stringify(restricted))
    ) as unknown as File
  );
  check(
    "restricted-scheme tab is skipped",
    sumR.tabs === 0 && sumR.skipped === 1
  );

  // invalid file rejected
  let threw = false;
  try {
    await importBackup(
      fileFrom("x.json", strToU8(JSON.stringify({ app: "nope" }))) as unknown as File
    );
  } catch {
    threw = true;
  }
  check("non-backup file is rejected", threw);

  console.log(` RESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
