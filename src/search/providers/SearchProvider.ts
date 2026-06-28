import type {
  SearchQuery,
  SearchResult,
  SearchSource,
} from "../models";

export interface SearchProvider {
  readonly source: SearchSource;

  search(
    query: SearchQuery
  ): Promise<SearchResult[]>;
}