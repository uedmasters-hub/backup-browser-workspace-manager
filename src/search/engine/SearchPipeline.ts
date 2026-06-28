import type {
  SearchQuery,
  SearchResult,
} from "../models";

import {
  ProviderRegistry,
} from "../providers";

import SearchRanker from "./SearchRanker";
import ResultLimiter from "../results/ResultLimiter";

export default class SearchPipeline {
  static async run(
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const providers = ProviderRegistry.getProviders();

    const settled = await Promise.allSettled(
      providers.map((provider) => provider.search(query))
    );

    const results = settled.flatMap((outcome) =>
      outcome.status === "fulfilled" ? outcome.value : []
    );

    const ranked = SearchRanker.rank(results);

    return ResultLimiter.limit(ranked, 50);
  }
}
