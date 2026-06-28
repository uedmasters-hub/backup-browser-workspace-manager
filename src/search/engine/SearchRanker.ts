import type {
  SearchResult,
} from "../models";

export default class SearchRanker {
  static rank(
    results: SearchResult[]
  ): SearchResult[] {
    return [...results].sort(
      (a, b) =>
        b.score - a.score
    );
  }
}