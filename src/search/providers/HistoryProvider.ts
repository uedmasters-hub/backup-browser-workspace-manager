import type { SearchProvider } from "./SearchProvider";
import type { SearchQuery, SearchResult } from "../models";
import type { SearchableHistory } from "../entities";

import HistoryRepository from "../repositories/HistoryRepository";
import SearchScorer from "../engine/SearchScorer";
import SearchTokenizer from "../engine/SearchTokenizer";
import { recencyBoost } from "../engine/Boosts";
import { extractDomain } from "../util/url";
import { openUrl } from "../../browser/services/navigationService";

const SOURCE_BASE = 70;
const MIN_QUERY = 2;

export default class HistoryProvider implements SearchProvider {
  readonly source = "history" as const;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const text = query.text.trim();
    if (text.length < MIN_QUERY) {
      return [];
    }

    const tokens = SearchTokenizer.tokenize(text);
    const items = await HistoryRepository.search(text);
    const results: SearchResult[] = [];

    for (const item of items) {
      const match = SearchScorer.scoreFields(tokens, text, [
        { name: "title", value: item.title, weight: 1 },
        { name: "domain", value: extractDomain(item.url), weight: 0.7 },
        { name: "url", value: item.url, weight: 0.4 },
      ]);

      if (!match) {
        continue;
      }

      // Frequency: pages visited often rank higher (capped).
      const frequencyBoost = Math.min(item.visitCount, 20) * 0.4;

      results.push(
        this.toResult(
          item,
          match.score * SOURCE_BASE +
            frequencyBoost +
            recencyBoost(item.lastAccessedAt),
          match.matchedFields,
          match.highlights
        )
      );
    }

    return results;
  }

  private toResult(
    item: SearchableHistory,
    score: number,
    matchedFields: string[],
    highlights: string[]
  ): SearchResult {
    return {
      id: item.id,
      source: "history",
      title: item.title,
      subtitle: item.subtitle,
      score,
      matchedFields,
      highlights,
      timestamp: item.lastAccessedAt,
      payload: item,
      actions: [
        {
          id: "open",
          label: "Open",
          primary: true,
          run: async () => {
            await openUrl(item.url);
            if (typeof window !== "undefined") window.close();
          },
        },
      ],
    };
  }
}
