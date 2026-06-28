import type {
  SearchResult,
} from "../models";

export default class ResultSorter {
  static sort(
    results: SearchResult[]
  ) {
    return [...results].sort(
      (a, b) =>
        b.score - a.score
    );
  }
}