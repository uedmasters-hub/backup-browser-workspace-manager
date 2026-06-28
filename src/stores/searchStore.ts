import { create } from "zustand";

import SearchEngine from "../search/engine/SearchEngine";

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
}

interface SearchActions {
  setQuery: (query: string) => void;

  setFocused: (focused: boolean) => void;

  clear: () => void;

  search: (query: string) => Promise<void>;

  /** Empty-query discovery: favorite and recent tabs + workspaces. */
  discover: () => Promise<void>;

  setActiveIndex: (index: number) => void;

  moveActive: (delta: number) => void;

  runActive: () => Promise<void>;
}

type SearchStore = SearchState & SearchActions;

function isDeep(query: string): boolean {
  return query.trim().startsWith("@deep");
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: "",

  status: "idle",

  results: [],

  recentSearches: [],

  deepMode: false,

  focused: false,

  activeIndex: 0,

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
    }),

  search: async (query) => {
    const trimmed = query.trim();

    if (!trimmed) {
      // Falling back to discovery keeps the overlay useful while empty.
      await get().discover();
      return;
    }

    set({ status: "searching" });

    try {
      const results = await SearchEngine.search(query);

      set((state) => ({
        query,
        results,
        activeIndex: 0,
        status: results.length ? "success" : "empty",
        deepMode: isDeep(query),
        recentSearches: [
          trimmed,
          ...state.recentSearches.filter(
            (item) => item !== trimmed
          ),
        ].slice(0, 8),
      }));
    } catch {
      set({ status: "error", results: [], activeIndex: 0 });
    }
  },

  discover: async () => {
    try {
      // An empty query routes every provider through its discovery path.
      const results = await SearchEngine.search("");

      set({
        results,
        activeIndex: 0,
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
}));
