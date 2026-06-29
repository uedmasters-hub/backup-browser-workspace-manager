import type {
  SearchProvider,
} from "./SearchProvider";

import type {
  SearchQuery,
  SearchResult,
} from "../models";

import type {
  SearchableWorkspace,
} from "../entities";

import WorkspaceRepository from "../repositories/WorkspaceRepository";

import SearchScorer from "../engine/SearchScorer";
import SearchTokenizer from "../engine/SearchTokenizer";
import { recencyBoost } from "../engine/Boosts";

import { focusWindow } from "../../browser/services/windowService";

const SOURCE_BASE = 100;
const DISCOVERY_LIMIT = 6;

export default class WorkspaceProvider
  implements SearchProvider
{
  readonly source = "workspace" as const;

  async search(
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const workspaces = WorkspaceRepository.getAll().filter(
      (workspace) => !workspace.archived
    );

    const text = query.text.trim();

    if (!text) {
      return this.discovery(workspaces);
    }

    const tokens = SearchTokenizer.tokenize(text);

    const results: SearchResult[] = [];

    for (const workspace of workspaces) {
      const match = SearchScorer.scoreFields(tokens, text, [
        { name: "title", value: workspace.title, weight: 1 },
        {
          name: "keywords",
          value: workspace.keywords.join(" "),
          weight: 0.4,
        },
      ]);

      if (!match) {
        continue;
      }

      const score =
        match.score * SOURCE_BASE +
        recencyBoost(workspace.updatedAt);

      results.push(
        this.toResult(
          workspace,
          score,
          match.matchedFields,
          match.highlights
        )
      );
    }

    return results;
  }

  private discovery(
    workspaces: SearchableWorkspace[]
  ): SearchResult[] {
    return [...workspaces]
      .sort(
        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
      )
      .slice(0, DISCOVERY_LIMIT)
      .map((workspace, index) =>
        this.toResult(
          workspace,
          50 + recencyBoost(workspace.updatedAt) - index,
          ["title"],
          []
        )
      );
  }

  private toResult(
    workspace: SearchableWorkspace,
    score: number,
    matchedFields: string[],
    highlights: string[]
  ): SearchResult {
    return {
      id: workspace.id,

      source: "workspace",

      title: workspace.title,

      subtitle: workspace.subtitle,

      icon:
        (workspace.metadata?.emoji as string | undefined) ??
        undefined,

      score,

      matchedFields,

      highlights,

      timestamp: workspace.updatedAt,

      payload: workspace,

      actions: [
        {
          id: "open",
          label: "Open",
          primary: true,
          run: async () => {
            await focusWindow(workspace.chromeWindowId);

            if (typeof window !== "undefined") {
              window.close();
            }
          },
        },
      ],
    };
  }
}
