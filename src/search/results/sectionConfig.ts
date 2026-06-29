import type { SearchSource } from "../models";

/** Fixed display order + labels + per-source caps for the results list. */
export const SECTION_ORDER: SearchSource[] = [
  "workspace",
  "tab",
  "bookmark",
  "history",
  "download",
  "session",
  "archive",
  "page",
  "clipboard",
];

export const SECTION_TITLES: Record<SearchSource, string> = {
  workspace: "Workspaces",
  tab: "Tabs",
  bookmark: "Bookmarks",
  history: "History",
  download: "Downloads",
  session: "Recently closed",
  archive: "Archived",
  page: "Pages",
  clipboard: "Clipboard",
};

export const SECTION_CAPS: Record<SearchSource, number> = {
  workspace: 8,
  tab: 12,
  bookmark: 8,
  history: 10,
  download: 6,
  session: 6,
  archive: 6,
  page: 6,
  clipboard: 6,
};

export const GLOBAL_CAP = 50;
