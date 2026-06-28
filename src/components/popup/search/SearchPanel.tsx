import { useSearchStore } from "../../../stores/searchStore";

import SearchLoading from "./SearchLoading";
import SearchEmpty from "./SearchEmpty";
import SearchResultList from "./SearchResultList";

export default function SearchPanel() {
  const status = useSearchStore((state) => state.status);
  const results = useSearchStore((state) => state.results);
  const query = useSearchStore((state) => state.query);
  const recentSearches = useSearchStore(
    (state) => state.recentSearches
  );
  const setQuery = useSearchStore((state) => state.setQuery);

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
    // Different copy for "nothing to discover yet" vs "no matches".
    if (isDiscovery) {
      return (
        <div className="px-5 py-16 text-center text-sm text-neutral-400">
          Start typing to search your tabs and workspaces.
        </div>
      );
    }

    return <SearchEmpty />;
  }

  return (
    <div className="space-y-3 p-4">
      {isDiscovery && recentSearches.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1 pb-1">
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
        </div>
      )}

      <div className="px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
        {isDiscovery ? "Jump to" : `${results.length} results`}
      </div>

      <SearchResultList results={results} />
    </div>
  );
}
