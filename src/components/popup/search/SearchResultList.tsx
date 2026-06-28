import SearchResultCard from "./SearchResultCard";

import { useSearchStore } from "../../../stores/searchStore";

import type {
  SearchResult,
} from "../../../search/models";

type Props = {
  results: SearchResult[];
};

export default function SearchResultList({ results }: Props) {
  const activeIndex = useSearchStore(
    (state) => state.activeIndex
  );

  const setActiveIndex = useSearchStore(
    (state) => state.setActiveIndex
  );

  return (
    <div className="space-y-2">
      {results.map((result, index) => (
        <SearchResultCard
          key={result.id}
          result={result}
          active={index === activeIndex}
          onHover={() => setActiveIndex(index)}
        />
      ))}
    </div>
  );
}
