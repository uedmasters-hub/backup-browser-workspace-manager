import type { SearchQuery, SearchResult } from "../models";

import { ProviderRegistry } from "../providers";

import ResultArranger from "../results/ResultArranger";

const PROVIDER_TIMEOUT_MS = 1500;

/** Resolve to [] if a provider is too slow, so one source can't stall search. */
function withTimeout(
  promise: Promise<SearchResult[]>
): Promise<SearchResult[]> {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve([]),
      PROVIDER_TIMEOUT_MS
    );

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve([]);
      });
  });
}

export default class SearchPipeline {
  static async run(
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const providers = ProviderRegistry.getProviders();

    const settled = await Promise.all(
      providers.map((provider) =>
        withTimeout(provider.search(query))
      )
    );

    const results = settled.flat();

    return ResultArranger.arrange(results);
  }
}
