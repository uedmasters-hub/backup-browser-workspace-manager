import { CheckSquare, Layers, X } from "lucide-react";

import { useSearchStore } from "../../../stores/searchStore";

import SearchLoading from "./SearchLoading";
import SearchEmpty from "./SearchEmpty";
import SearchResultCard from "./SearchResultCard";

import { SECTION_TITLES } from "../../../search/results/sectionConfig";

import type { SearchSource } from "../../../search/models";

export default function SearchPanel() {
  const status = useSearchStore((state) => state.status);
  const results = useSearchStore((state) => state.results);
  const query = useSearchStore((state) => state.query);
  const recentSearches = useSearchStore((state) => state.recentSearches);
  const activeIndex = useSearchStore((state) => state.activeIndex);
  const setActiveIndex = useSearchStore((state) => state.setActiveIndex);
  const setQuery = useSearchStore((state) => state.setQuery);
  const clearRecentSearches = useSearchStore((s) => s.clearRecentSearches);

  const selecting = useSearchStore((s) => s.selecting);
  const toggleSelecting = useSearchStore((s) => s.toggleSelecting);
  const selectedIds = useSearchStore((s) => s.selectedIds);
  const toggleSelect = useSearchStore((s) => s.toggleSelect);
  const clearSelection = useSearchStore((s) => s.clearSelection);
  const groupSelected = useSearchStore((s) => s.groupSelected);
  const closeTabResult = useSearchStore((s) => s.closeTabResult);

  const isDiscovery = query.trim().length === 0;

  if (status === "searching") {
    return <SearchLoading />;
  }

  if (status === "error") {
    return (
      <div className="px-5 py-12 text-center text-sm text-red-500">
        Something went wrong. Try again.
      </div>
    );
  }

  if (status === "empty") {
    if (isDiscovery) {
      return (
        <div className="min-h-full bg-[#F6F7FB] px-5 py-16 text-center text-sm text-neutral-400">
          Start typing to search your tabs, workspaces, bookmarks and history.
        </div>
      );
    }
    return <SearchEmpty />;
  }

  return (
    <div className="relative min-h-full bg-[#F6F7FB]">
      <div className="px-3 py-2 pb-20">
        {isDiscovery && recentSearches.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-2.5 pb-2 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              Recent
            </span>
            {recentSearches.slice(0, 5).map((term) => (
              <button
                key={term}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setQuery(term)}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-200"
              >
                {term}
              </button>
            ))}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearRecentSearches}
              className="ml-auto text-[11px] font-medium text-neutral-400 transition-colors hover:text-neutral-700"
            >
              Clear
            </button>
          </div>
        )}

        {results.map((result, index) => {
          const prev = results[index - 1];
          const showHeader = !prev || prev.source !== result.source;

          return (
            <div key={result.id}>
              {showHeader && (
                <div className="flex items-center justify-between px-2.5 pb-1 pt-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {SECTION_TITLES[result.source as SearchSource] ??
                      result.source}
                  </span>
                  {result.source === "tab" && (
                    <button
                      type="button"
                      aria-pressed={selecting}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={toggleSelecting}
                      className={[
                        "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                        selecting
                          ? "bg-neutral-900 text-white"
                          : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                      ].join(" ")}
                    >
                      <CheckSquare size={12} />
                      {selecting ? "Done" : "Select"}
                    </button>
                  )}
                </div>
              )}

              <SearchResultCard
                result={result}
                active={index === activeIndex}
                onHover={() => setActiveIndex(index)}
                selectable={result.source === "tab"}
                selected={selectedIds.includes(result.id)}
                selectionActive={selecting}
                onToggleSelect={() => toggleSelect(result.id)}
                onClose={() => void closeTabResult(result.id)}
              />
            </div>
          );
        })}
      </div>

      {selectedIds.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 border-t border-neutral-100 bg-white/95 p-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void groupSelected()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-900 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Layers size={16} />
              Group {selectedIds.length}{" "}
              {selectedIds.length === 1 ? "tab" : "tabs"}
              {query.trim() ? ` · “${query.trim()}”` : ""}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearSelection}
              aria-label="Clear selection"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
