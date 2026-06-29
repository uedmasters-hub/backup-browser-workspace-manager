import type { WorkspaceTab } from "../../types/tab";

export type TabSortMode =
  | "chrome-order"
  | "favorites"
  | "newest"
  | "oldest"
  | "title-asc"
  | "title-desc"
  | "pinned";

export const TAB_SORT_OPTIONS: Array<{
  value: TabSortMode;
  label: string;
}> = [
  { value: "chrome-order", label: "Chrome tab order" },
  { value: "favorites", label: "Favorites first" },
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "title-asc", label: "Title A–Z" },
  { value: "title-desc", label: "Title Z–A" },
  { value: "pinned", label: "Pinned first" },
];

function compareFavorite(
  a: WorkspaceTab,
  b: WorkspaceTab
): number {
  if (a.favorite === b.favorite) {
    return 0;
  }

  return a.favorite ? -1 : 1;
}

function compareAccessed(
  a: WorkspaceTab,
  b: WorkspaceTab,
  direction: "newest" | "oldest"
): number {
  if (a.lastAccessed === undefined) {
    return b.lastAccessed === undefined ? 0 : 1;
  }

  if (b.lastAccessed === undefined) {
    return -1;
  }

  return direction === "newest"
    ? b.lastAccessed - a.lastAccessed
    : a.lastAccessed - b.lastAccessed;
}

export function sortTabs(
  tabs: WorkspaceTab[],
  mode: TabSortMode
): WorkspaceTab[] {
  return [...tabs].sort((a, b) => {
    if (mode === "chrome-order") {
      return a.index - b.index;
    }

    // Computed sorts preserve favorite priority; manual Chrome order does not.
    const favoriteOrder = compareFavorite(a, b);

    if (favoriteOrder !== 0) {
      return favoriteOrder;
    }

    switch (mode) {
      case "newest":
        return compareAccessed(a, b, "newest");

      case "oldest":
        return compareAccessed(a, b, "oldest");

      case "title-asc":
        return a.title.localeCompare(b.title);

      case "title-desc":
        return b.title.localeCompare(a.title);

      case "pinned":
        if (a.pinned !== b.pinned) {
          return a.pinned ? -1 : 1;
        }

        return compareAccessed(a, b, "newest");

      case "favorites":
        return compareAccessed(a, b, "newest");
    }
  });
}
