import type {
  SearchResult,
} from "../models";

export default class ResultLimiter {
  static limit(
    results: SearchResult[],
    max = 50
  ) {
    return results.slice(
      0,
      max
    );
  }
}