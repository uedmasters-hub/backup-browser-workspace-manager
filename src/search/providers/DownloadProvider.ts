import type { SearchProvider } from "./SearchProvider";
import type { SearchQuery, SearchResult } from "../models";
import type { SearchableDownload } from "../entities";

import DownloadRepository from "../repositories/DownloadRepository";
import SearchScorer from "../engine/SearchScorer";
import SearchTokenizer from "../engine/SearchTokenizer";
import { extractDomain } from "../util/url";
import {
  openDownload,
  showDownload,
} from "../../browser/services/downloadService";

const SOURCE_BASE = 65;
const MIN_QUERY = 2;

export default class DownloadProvider implements SearchProvider {
  readonly source = "download" as const;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const text = query.text.trim();
    if (text.length < MIN_QUERY) {
      return [];
    }

    const tokens = SearchTokenizer.tokenize(text);
    const downloads = await DownloadRepository.getAll();
    const results: SearchResult[] = [];

    for (const download of downloads) {
      const match = SearchScorer.scoreFields(tokens, text, [
        { name: "title", value: download.title, weight: 1 },
        { name: "extension", value: download.extension, weight: 0.5 },
        { name: "domain", value: extractDomain(download.url), weight: 0.5 },
      ]);

      if (!match) {
        continue;
      }

      results.push(
        this.toResult(
          download,
          match.score * SOURCE_BASE,
          match.matchedFields,
          match.highlights
        )
      );
    }

    return results;
  }

  private toResult(
    download: SearchableDownload,
    score: number,
    matchedFields: string[],
    highlights: string[]
  ): SearchResult {
    return {
      id: download.id,
      source: "download",
      title: download.title,
      subtitle: download.subtitle,
      score,
      matchedFields,
      highlights,
      payload: download,
      actions: [
        {
          id: "open",
          label: "Open file",
          primary: true,
          run: async () => {
            await openDownload(download.downloadId);
          },
        },
        {
          id: "show",
          label: "Show in folder",
          run: async () => {
            await showDownload(download.downloadId);
          },
        },
      ],
    };
  }
}
