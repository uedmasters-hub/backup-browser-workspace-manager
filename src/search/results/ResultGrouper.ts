import type {
  SearchResult,
  SearchSection,
} from "../models";

export default class ResultGrouper {
  static group(
    results: SearchResult[]
  ): SearchSection[] {
    const map =
      new Map<
        string,
        SearchResult[]
      >();

    results.forEach(
      (result) => {
        const list =
          map.get(
            result.source
          ) ?? [];

        list.push(result);

        map.set(
          result.source,
          list
        );
      }
    );

    return Array.from(
      map.entries()
    ).map(
      ([
        source,
        results,
      ]) => ({
        id: source,

        title:
          source
            .charAt(0)
            .toUpperCase() +
          source.slice(1),

        results,
      })
    );
  }
}