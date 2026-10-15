export const STORAGE_KEYS = {
  WORKSPACES: "workspaces",
  FAVORITE_TABS: "favoriteTabs",
  TAB_SORT_MODE: "tabSortMode",
  NOTES: "workspaceNotes",
  NOTE_PROJECTS: "noteProjects",
  LAST_SYNCED: "lastSyncedAt",
  FLOATER_ENABLED: "floaterEnabled",
  FLOATER_NOTE: "floaterNote",
  FLOATER_POS: "floaterPosition",
  FLOATER_NOTES: "floaterNotes",
  PRIVATE_HINT_DISMISSED: "privateWindowsHintDismissed",
  UPDATE_NOTICE: "updateNotice",
  LAST_UPDATE_CHECK: "lastUpdateCheck",
  APP_DOCK_ENABLED: "appDockEnabled",
  APP_DOCK_HIDDEN: "appDockHidden",
  AUTO_GROUP_MODE: "autoGroupMode",
  /** Groups the user unchecked in the review ("cat:social", "site:acme.com"). */
  AUTO_GROUP_EXCLUDED: "autoGroupExcluded",
  /** Session-only (chrome.storage.session): tab/group ids, cleared when the browser closes. */
  AUTO_GROUP_STATE: "autoGroupState",
} as const;
