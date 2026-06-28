import type {
  SearchQuery,
} from "../models";

import SearchNormalizer from "../engine/SearchNormalizer";

export default class QueryParser {
  static parse(
    input: string
  ): SearchQuery {
    const normalized =
      SearchNormalizer.normalize(
        input
      );

    const deep =
      normalized.startsWith(
        "@deep "
      ) ||
      normalized === "@deep";

    return {
      raw: input,

      text: deep
        ? normalized
            .replace(
              "@deep",
              ""
            )
            .trim()
        : normalized,

      mode: deep
        ? "deep"
        : "instant",

      timestamp: Date.now(),
    };
  }
}