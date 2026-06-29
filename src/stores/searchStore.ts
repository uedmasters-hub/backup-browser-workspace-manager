import { create } from "zustand";

import SearchEngine from "../search/engine/SearchEngine";
import { groupTabsByIds } from "../browser/services/tabGroupService";
import { closeTabs } from "../browser/services/tabActionService";

import type {
  SearchResult,
  SearchStatus,
} from "../search/models";

interface SearchState {
  query: string;

  status: SearchStatus;

  results: SearchResult[];

  recentSearches: string[];

  deepMode: boolean;

  /** Whether the search box currently has focus (drives discovery + overlay). */
  focused: boolean;

  /** Highlighted row for keyboard navigation. */
  activeIndex: number;

  /** Result ids selected for grouping (tab results only). */
  selectedIds: string[];

  /** Explicit selection mode toggled from the Select button. */
  selecting: boolean;
}

interface SearchActions {
  setQuery: (query: string) => void;

  setFocused: (focused: boolean) => void;

  clear: () => void;

  search: (query: string) => Promise<void>;

  /** Empty-query discovery: favorites + recent tabs. */
  discover: () => Promise<void>;

  setActiveIndex: (index: number) => void;

  moveActive: (delta: number) => void;

  runActive: () => Promise<void>;

  toggleSelecting: () => void;

  toggleSelect: (id: string) => void;

  clearSelection: () => void;

  groupSelected: () => Promise<void>;

  closeTabResult: (id: string) => Promise<void>;

  clearRecentSearches: () => void;
}

type SearchStore = SearchState & SearchActions;

function isDeep(query: string): boolean {
  return query.trim().startsWith("@deep");
}

/** Results are grouped by section, so the top-scored item isn't always first. */
function bestIndex(results: SearchResult[]): number {
  if (results.length === 0) {
    return 0;
  }

  let best = 0;
  for (let i = 1; i < results.length; i++) {
    if (results[i].score > results[best].score) {
      best = i;
    }
  }
  return best;
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",

  status: "idle",

  results: [],

  recentSearches: [],

  deepMode: false,

  focused: false,

  activeIndex: 0,

  selectedIds: [],

  selecting: false,

  setQuery: (query) =>
    set({
      query,
      deepMode: isDeep(query),
    }),

  setFocused: (focused) => set({ focused }),

  clear: () =>
    set({
      query: "",
      status: "idle",
      results: [],
      deepMode: false,
      activeIndex: 0,
      selectedIds: [],
      selecting: false,
    }),

  search: async (query) => {
    const trimmed = query.trim();

    if (!trimmed) {
      // Falling back to discovery keeps the overlay useful while empty.
      await get().discover();
      return;
    }

    // Only show the spinner on the first search; later keystrokes keep the
    // current results visible until the new ones arrive (no flicker).
    if (get().results.length === 0) {
      set({ status: "searching" });
    }

    try {
      const results = await SearchEngine.search(query);

      // Drop stale results: the box may have changed while we awaited.
      if (get().query.trim() !== trimmed) {
        return;
      }

      set((state) => ({
        results,
        activeIndex: bestIndex(results),
        status: results.length ? "success" : "empty",
        recentSearches: [
          trimmed,
          ...state.recentSearches.filter(
            (item) => item !== trimmed
          ),
        ].slice(0, 8),
      }));
    } catch {
      if (get().query.trim() === trimmed) {
        set({ status: "error", results: [], activeIndex: 0 });
      }
    }
  },

  discover: async () => {
    try {
      // An empty query routes every provider through its discovery path.
      const results = await SearchEngine.search("");

      // Ignore if the user has started typing in the meantime.
      if (get().query.trim()) {
        return;
      }

      set({
        results,
        activeIndex: bestIndex(results),
        status: results.length ? "success" : "empty",
      });
    } catch {
      set({ status: "error", results: [], activeIndex: 0 });
    }
  },

  setActiveIndex: (index) => set({ activeIndex: index }),

  moveActive: (delta) =>
    set((state) => {
      const count = state.results.length;

      if (count === 0) {
        return { activeIndex: 0 };
      }

      // Wrap around top/bottom.
      const next = (state.activeIndex + delta + count) % count;

      return { activeIndex: next };
    }),

  runActive: async () => {
    const { results, activeIndex } = get();

    const result = results[activeIndex];

    if (!result) {
      return;
    }

    const primary =
      result.actions.find((action) => action.primary) ??
      result.actions[0];

    await primary?.run();
  },

  toggleSelecting: () =>
    set((state) => ({
      selecting: !state.selecting,
      selectedIds: state.selecting ? [] : state.selectedIds,
    })),

  toggleSelect: (id) =>
    set((state) => ({
      selectedIds: state.selectedIds.includes(id)
        ? state.selectedIds.filter((x) => x !== id)
        : [...state.selectedIds, id],
    })),

  clearSelection: () => set({ selectedIds: [], selecting: false }),

  groupSelected: async () => {
    const { results, selectedIds, query } = get();

    const tabIds = results
      .filter(
        (r) => r.source === "tab" && selectedIds.includes(r.id)
      )
      .map((r) => (r.payload as { tabId: number }).tabId)
      .filter((id): id is number => typeof id === "number");

    if (tabIds.length < 1) {
      return;
    }

    try {
      await groupTabsByIds(tabIds, query.trim() || "Group");
      set({ selectedIds: [] });
      if (typeof window !== "undefined") {
        window.close();
      }
    } catch {
      // Leave the selection intact so the user can retry.
    }
  },

  closeTabResult: async (id) => {
    const result = get().results.find((r) => r.id === id);
    const tabId = (result?.payload as { tabId?: number } | undefined)
      ?.tabId;
    if (typeof tabId !== "number") {
      return;
    }
    try {
      await closeTabs([tabId]);
      set((state) => ({
        results: state.results.filter((r) => r.id !== id),
        selectedIds: state.selectedIds.filter((x) => x !== id),
      }));
    } catch {
      // Tab may already be gone; ignore.
    }
  },

  clearRecentSearches: () => set({ recentSearches: [] }),
}));
