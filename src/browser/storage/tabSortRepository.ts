import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { TabSortMode } from "../../stores/selectors/tabSelectors";

const SORT_MODES: TabSortMode[] = [
  "chrome-order",
  "favorites",
  "newest",
  "oldest",
  "title-asc",
  "title-desc",
  "pinned",
];

export async function getTabSortMode(): Promise<TabSortMode> {
  const result = await chrome.storage.local.get(
    STORAGE_KEYS.TAB_SORT_MODE
  );
  const mode = result[STORAGE_KEYS.TAB_SORT_MODE];

  return SORT_MODES.includes(mode as TabSortMode)
    ? (mode as TabSortMode)
    : "favorites";
}

export async function saveTabSortMode(
  mode: TabSortMode
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TAB_SORT_MODE]: mode,
  });
}
