import type { SearchProvider } from "./SearchProvider";
import type { SearchQuery, SearchResult } from "../models";
import type { SearchableArchive } from "../entities";

import ArchiveRepository from "../repositories/ArchiveRepository";
import SearchScorer from "../engine/SearchScorer";
import SearchTokenizer from "../engine/SearchTokenizer";
import { focusWindow } from "../../browser/services/windowService";

const SOURCE_BASE = 85;
const MIN_QUERY = 2;

export default class ArchiveProvider implements SearchProvider {
  readonly source = "archive" as const;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const text = query.text.trim();
    if (text.length < MIN_QUERY) {
      return [];
    }

    const tokens = SearchTokenizer.tokenize(text);
    const archived = ArchiveRepository.getAll();
    const results: SearchResult[] = [];

    for (const workspace of archived) {
      const match = SearchScorer.scoreFields(tokens, text, [
        { name: "title", value: workspace.title, weight: 1 },
      ]);

      if (!match) {
        continue;
      }

      results.push(
        this.toResult(
          workspace,
          match.score * SOURCE_BASE,
          match.matchedFields,
          match.highlights
        )
      );
    }

    return results;
  }

  private toResult(
    workspace: SearchableArchive,
    score: number,
    matchedFields: string[],
    highlights: string[]
  ): SearchResult {
    return {
      id: workspace.id,
      source: "archive",
      title: workspace.title,
      subtitle: workspace.subtitle,
      icon: (workspace.metadata?.emoji as string | undefined) ?? undefined,
      score,
      matchedFields,
      highlights,
      payload: workspace,
      actions: [
        {
          id: "open",
          label: "Open",
          primary: true,
          run: async () => {
            await focusWindow(workspace.workspaceId);
            if (typeof window !== "undefined") window.close();
          },
        },
      ],
    };
  }
}
