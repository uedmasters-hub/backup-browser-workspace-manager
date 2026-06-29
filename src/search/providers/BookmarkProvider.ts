import type { SearchProvider } from "./SearchProvider";
import type { SearchQuery, SearchResult } from "../models";
import type { SearchableBookmark } from "../entities";

import BookmarkRepository from "../repositories/BookmarkRepository";
import SearchScorer from "../engine/SearchScorer";
import SearchTokenizer from "../engine/SearchTokenizer";
import { recencyBoost } from "../engine/Boosts";
import { extractDomain } from "../util/url";
import { openUrl } from "../../browser/services/navigationService";

const SOURCE_BASE = 80;
const MIN_QUERY = 2;

export default class BookmarkProvider implements SearchProvider {
  readonly source = "bookmark" as const;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const text = query.text.trim();
    if (text.length < MIN_QUERY) {
      return [];
    }

    const tokens = SearchTokenizer.tokenize(text);
    const bookmarks = await BookmarkRepository.getAll();
    const results: SearchResult[] = [];

    for (const bookmark of bookmarks) {
      const match = SearchScorer.scoreFields(tokens, text, [
        { name: "title", value: bookmark.title, weight: 1 },
        { name: "domain", value: extractDomain(bookmark.url), weight: 0.7 },
        { name: "url", value: bookmark.url, weight: 0.4 },
        { name: "folder", value: bookmark.folder ?? "", weight: 0.3 },
      ]);

      if (!match) {
        continue;
      }

      results.push(
        this.toResult(
          bookmark,
          match.score * SOURCE_BASE + recencyBoost(bookmark.createdAt),
          match.matchedFields,
          match.highlights
        )
      );
    }

    return results;
  }

  private toResult(
    bookmark: SearchableBookmark,
    score: number,
    matchedFields: string[],
    highlights: string[]
  ): SearchResult {
    return {
      id: bookmark.id,
      source: "bookmark",
      title: bookmark.title,
      subtitle: bookmark.subtitle,
      score,
      matchedFields,
      highlights,
      payload: bookmark,
      actions: [
        {
          id: "open",
          label: "Open",
          primary: true,
          run: async () => {
            await openUrl(bookmark.url);
            if (typeof window !== "undefined") window.close();
          },
        },
      ],
    };
  }
}
