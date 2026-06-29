import { zipStore, unzipStore, strToU8, strFromU8 } from "./zip";

import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { WorkspaceMetadata } from "../../types/workspace";

export const BACKUP_APP = "browser-workspace-manager";
export const BACKUP_VERSION = 1;

export interface BackupTab {
  title: string;
  url: string;
  favIconUrl?: string;
  pinned: boolean;
  groupId: number;
  index: number;
  favorite: boolean;
}

export interface BackupGroup {
  id: number;
  title: string;
  color: string;
  collapsed: boolean;
}

export interface BackupWindow {
  chromeWindowId: number;
  name: string;
  emoji?: string;
  color?: string;
  archived: boolean;
  focused: boolean;
  groups: BackupGroup[];
  tabs: BackupTab[];
}

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  userAgent?: string;
  /** Everything persisted under chrome.storage.local (notes, favorites,
   * sort mode, workspace metadata incl. archive, last-synced, …). */
  settings: Record<string, unknown>;
  /** Live snapshot of windows, their groups and tabs. */
  windows: BackupWindow[];
}

const GROUP_COLOR_HEX: Record<string, string> = {
  grey: "#5f6368",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#188038",
  pink: "#d01884",
  purple: "#a142f4",
  cyan: "#007b83",
  orange: "#fa903e",
};

/** Read all of chrome.storage.local plus a live window/tab/group snapshot. */
export async function collectBackup(): Promise<Backup> {
  const settings = (await chrome.storage.local.get(null)) as Record<
    string,
    unknown
  >;

  const favoriteUrls = new Set(
    (settings[STORAGE_KEYS.FAVORITE_TABS] as string[] | undefined) ?? []
  );

  const workspaces =
    (settings[STORAGE_KEYS.WORKSPACES] as WorkspaceMetadata[] | undefined) ??
    [];

  const chromeWindows = await chrome.windows.getAll({ populate: true });

  const groupsById = new Map<number, BackupGroup>();
  if (chrome.tabGroups?.query) {
    try {
      const groups = await chrome.tabGroups.query({});
      for (const group of groups) {
        groupsById.set(group.id, {
          id: group.id,
          title: group.title ?? "",
          color: String(group.color ?? "grey"),
          collapsed: Boolean(group.collapsed),
        });
      }
    } catch {
      // tabGroups unavailable; tabs still export ungrouped.
    }
  }

  const windows: BackupWindow[] = chromeWindows.map((win, index) => {
    const meta = workspaces.find((w) => w.chromeWindowId === win.id);
    const tabs = win.tabs ?? [];

    const usedGroupIds = new Set<number>();
    const backupTabs: BackupTab[] = tabs.map((tab) => {
      const groupId =
        typeof tab.groupId === "number" ? tab.groupId : -1;
      if (groupId !== -1) {
        usedGroupIds.add(groupId);
      }
      return {
        title: tab.title ?? tab.url ?? "Untitled",
        url: tab.url ?? "",
        favIconUrl: tab.favIconUrl,
        pinned: Boolean(tab.pinned),
        groupId,
        index: tab.index ?? 0,
        favorite: tab.url ? favoriteUrls.has(tab.url) : false,
      };
    });

    const groups = [...usedGroupIds]
      .map((id) => groupsById.get(id))
      .filter((g): g is BackupGroup => Boolean(g));

    return {
      chromeWindowId: win.id ?? 0,
      name: meta?.name ?? `Window ${index + 1}`,
      emoji: meta?.emoji,
      color: meta?.color,
      archived: meta?.archived ?? false,
      focused: win.focused ?? false,
      groups,
      tabs: backupTabs,
    };
  });

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    settings,
    windows,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** A standalone, dependency-free HTML page listing every tab as a link. */
export function buildTabsHtml(backup: Backup): string {
  const totalTabs = backup.windows.reduce(
    (sum, w) => sum + w.tabs.length,
    0
  );
  const exported = new Date(backup.exportedAt).toLocaleString();

  const link = (tab: BackupTab): string => {
    const safeUrl = escapeHtml(tab.url);
    const safeTitle = escapeHtml(tab.title || tab.url || "Untitled");
    const star = tab.favorite ? '<span class="star">★</span>' : "";
    const pin = tab.pinned ? '<span class="pin">PINNED</span>' : "";
    const host = (() => {
      try {
        return escapeHtml(new URL(tab.url).hostname);
      } catch {
        return "";
      }
    })();
    return `
      <li class="tab">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
          <span class="title">${star}${safeTitle}</span>
          <span class="meta">${pin}<span class="host">${host}</span></span>
        </a>
      </li>`;
  };

  const windowsHtml = backup.windows
    .map((win) => {
      const heading = `${win.emoji ? escapeHtml(win.emoji) + " " : ""}${escapeHtml(
        win.name
      )}`;

      const grouped = win.groups
        .map((group) => {
          const items = win.tabs
            .filter((t) => t.groupId === group.id)
            .map(link)
            .join("");
          if (!items) {
            return "";
          }
          const color = GROUP_COLOR_HEX[group.color] ?? "#5f6368";
          const title = escapeHtml(group.title || "Group");
          return `
            <div class="group">
              <div class="group-name" style="--c:${color}">
                <span class="dot"></span>${title}
              </div>
              <ul>${items}</ul>
            </div>`;
        })
        .join("");

      const ungrouped = win.tabs
        .filter((t) => t.groupId === -1)
        .map(link)
        .join("");

      return `
        <section class="window">
          <h2>${heading}${
            win.archived ? '<span class="badge">Archived</span>' : ""
          }<span class="count">${win.tabs.length} tabs</span></h2>
          ${grouped}
          ${ungrouped ? `<ul>${ungrouped}</ul>` : ""}
        </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Browser Workspace Manager — Tabs</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #f6f7fb; color: #171717;
    font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  .wrap { max-width: 820px; margin: 0 auto; padding: 40px 20px 80px; }
  header.top { margin-bottom: 28px; }
  header.top h1 { font-size: 22px; margin: 0 0 4px; }
  header.top p { margin: 0; color: #737373; font-size: 13px; }
  section.window {
    background: #fff; border: 1px solid #ececec; border-radius: 18px;
    padding: 18px 20px; margin-bottom: 18px;
  }
  section.window h2 {
    display: flex; align-items: center; gap: 10px;
    font-size: 16px; margin: 0 0 12px;
  }
  .count { margin-left: auto; font-size: 12px; font-weight: 500; color: #a3a3a3; }
  .badge {
    font-size: 10px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .04em; color: #92400e; background: #fef3c7;
    padding: 2px 8px; border-radius: 999px;
  }
  .group { margin: 10px 0; }
  .group-name {
    display: flex; align-items: center; gap: 8px;
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: .05em; color: #525252; margin: 14px 0 6px;
  }
  .group-name .dot {
    width: 9px; height: 9px; border-radius: 50%; background: var(--c);
  }
  ul { list-style: none; margin: 0; padding: 0; }
  li.tab a {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 10px; text-decoration: none;
    color: inherit;
  }
  li.tab a:hover { background: #f5f5f5; }
  li.tab .title {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; font-weight: 500;
  }
  li.tab .meta { display: flex; align-items: center; gap: 8px; }
  li.tab .host { color: #a3a3a3; font-size: 12px; }
  .star { color: #f59e0b; margin-right: 6px; }
  .pin {
    font-size: 9px; font-weight: 700; letter-spacing: .04em; color: #6b7280;
    border: 1px solid #e5e7eb; border-radius: 999px; padding: 1px 6px;
  }
  footer { margin-top: 28px; text-align: center; color: #a3a3a3; font-size: 12px; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <h1>Your tabs &amp; workspaces</h1>
      <p>${backup.windows.length} windows · ${totalTabs} tabs · exported ${escapeHtml(
        exported
      )}</p>
    </header>
    ${windowsHtml}
    <footer>Saved from Browser Workspace Manager · open this file anywhere, no extension needed</footer>
  </div>
</body>
</html>`;
}

function buildReadme(backup: Backup): string {
  return [
    "Browser Workspace Manager — Backup",
    "",
    `Exported: ${new Date(backup.exportedAt).toLocaleString()}`,
    `Windows: ${backup.windows.length}`,
    `Tabs: ${backup.windows.reduce((s, w) => s + w.tabs.length, 0)}`,
    "",
    "Files in this folder:",
    "  • backup.json  — full backup. Import it from the extension menu",
    "                   (Menu → Import) to rebuild your windows, tabs, groups,",
    "                   pins, favorites, notes, sort and archived state.",
    "  • tabs.html    — a standalone, clickable list of every tab. Open it",
    "                   in any browser; it needs no extension.",
    "",
    "Keep backup.json if you want to restore later.",
    "",
  ].join("\n");
}

function triggerDownload(filename: string, data: Uint8Array, mime: string) {
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Build the ZIP folder (backup.json + tabs.html + README) and download it. */
export async function exportBackup(): Promise<void> {
  const backup = await collectBackup();
  const json = JSON.stringify(backup, null, 2);
  const html = buildTabsHtml(backup);
  const readme = buildReadme(backup);

  const zipped = zipStore({
    "backup.json": strToU8(json),
    "tabs.html": strToU8(html),
    "README.txt": strToU8(readme),
  });

  triggerDownload(
    `bwm-backup-${stamp()}.zip`,
    zipped,
    "application/zip"
  );
}

export interface RestoreSummary {
  windows: number;
  tabs: number;
  groups: number;
  skipped: number;
}

function parseBackup(text: string): Backup {
  const parsed = JSON.parse(text) as Backup;
  if (parsed.app !== BACKUP_APP || typeof parsed.settings !== "object") {
    throw new Error("This file is not a Browser Workspace Manager backup.");
  }
  return parsed;
}

/** Read a .zip (with backup.json) or a raw backup.json into a Backup. */
export async function parseBackupFile(file: File): Promise<Backup> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const isZip =
    file.name.toLowerCase().endsWith(".zip") ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b); // "PK"

  let text: string;
  if (isZip) {
    const files = unzipStore(buffer);
    const entry = files["backup.json"];
    if (!entry) {
      throw new Error("No backup.json found inside the ZIP.");
    }
    text = strFromU8(entry);
  } else {
    text = strFromU8(buffer);
  }

  return parseBackup(text);
}

/** Schemes Chrome refuses to (re)open via the extension API. */
function isOpenableUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  return /^(https?|ftp):/i.test(url);
}

/**
 * Full restore: re-create every window with its tabs (order + pinned),
 * rebuild tab groups (title/color/collapsed), restore favorites/notes/sort,
 * and re-map workspace metadata (name/emoji/color/archive) onto the freshly
 * created window ids. Non-destructive: existing windows are left open.
 */
export async function restoreBackup(
  backup: Backup
): Promise<RestoreSummary> {
  // 1) Restore all settings except WORKSPACES (those ids are stale; rebuilt
  //    below against the new windows).
  const settings = { ...backup.settings };
  delete settings[STORAGE_KEYS.WORKSPACES];
  await chrome.storage.local.set(settings);

  const newWorkspaces: WorkspaceMetadata[] = [];
  let tabsOpened = 0;
  let groupsMade = 0;
  let skipped = 0;

  for (const win of backup.windows) {
    const ordered = [...win.tabs].sort((a, b) => a.index - b.index);
    const openable = ordered.filter((t) => isOpenableUrl(t.url));
    skipped += ordered.length - openable.length;

    if (openable.length === 0) {
      continue;
    }

    let created: chrome.windows.Window | undefined;
    try {
      created = await chrome.windows.create({
        url: openable.map((t) => t.url),
        focused: false,
      });
    } catch {
      continue;
    }

    const windowId = created?.id;
    const createdTabs = created?.tabs ?? [];

    const groupBuckets = new Map<number, number[]>();
    for (let i = 0; i < createdTabs.length && i < openable.length; i += 1) {
      const tabId = createdTabs[i].id;
      const source = openable[i];
      if (typeof tabId !== "number") {
        continue;
      }
      tabsOpened += 1;

      if (source.pinned) {
        try {
          await chrome.tabs.update(tabId, { pinned: true });
        } catch {
          // ignore individual failures
        }
      }

      if (source.groupId !== -1) {
        const bucket = groupBuckets.get(source.groupId) ?? [];
        bucket.push(tabId);
        groupBuckets.set(source.groupId, bucket);
      }
    }

    // Rebuild groups.
    if (chrome.tabGroups?.update && windowId != null) {
      for (const group of win.groups) {
        const ids = groupBuckets.get(group.id);
        if (!ids || ids.length === 0) {
          continue;
        }
        try {
          const gid = await (chrome.tabs.group({
            tabIds: ids as [number, ...number[]],
            createProperties: { windowId },
          }) as Promise<number>);
          await chrome.tabGroups.update(gid, {
            title: group.title,
            color: group.color as chrome.tabGroups.Color,
            collapsed: group.collapsed,
          });
          groupsMade += 1;
        } catch {
          // ignore group failures; tabs remain ungrouped
        }
      }
    }

    const now = new Date().toISOString();
    newWorkspaces.push({
      chromeWindowId: windowId ?? 0,
      name: win.name,
      color: win.color,
      emoji: win.emoji,
      archived: win.archived,
      createdAt: now,
      updatedAt: now,
    });
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.WORKSPACES]: newWorkspaces,
  });

  return {
    windows: backup.windows.length,
    tabs: tabsOpened,
    groups: groupsMade,
    skipped,
  };
}

/** Read a backup file and fully restore the system from it. */
export async function importBackup(file: File): Promise<RestoreSummary> {
  const backup = await parseBackupFile(file);
  return restoreBackup(backup);
}
