import type { SearchProvider } from "./SearchProvider";
import type { SearchQuery, SearchResult } from "../models";
import type { SearchableSession } from "../entities";

import SessionRepository from "../repositories/SessionRepository";
import SearchScorer from "../engine/SearchScorer";
import SearchTokenizer from "../engine/SearchTokenizer";
import { recencyBoost } from "../engine/Boosts";
import { restoreSession } from "../../browser/services/sessionService";

const SOURCE_BASE = 60;
const MIN_QUERY = 2;

export default class SessionProvider implements SearchProvider {
  readonly source = "session" as const;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const text = query.text.trim();
    if (text.length < MIN_QUERY) {
      return [];
    }

    const tokens = SearchTokenizer.tokenize(text);
    const sessions = await SessionRepository.getAll();
    const results: SearchResult[] = [];

    for (const session of sessions) {
      const match = SearchScorer.scoreFields(tokens, text, [
        { name: "title", value: session.title, weight: 1 },
      ]);

      if (!match) {
        continue;
      }

      results.push(
        this.toResult(
          session,
          match.score * SOURCE_BASE +
            recencyBoost(session.lastAccessedAt),
          match.matchedFields,
          match.highlights
        )
      );
    }

    return results;
  }

  private toResult(
    session: SearchableSession,
    score: number,
    matchedFields: string[],
    highlights: string[]
  ): SearchResult {
    return {
      id: session.id,
      source: "session",
      title: session.title,
      subtitle: session.subtitle,
      score,
      matchedFields,
      highlights,
      timestamp: session.lastAccessedAt,
      payload: session,
      actions: [
        {
          id: "restore",
          label: "Reopen",
          primary: true,
          run: async () => {
            await restoreSession(session.sessionId);
            if (typeof window !== "undefined") window.close();
          },
        },
      ],
    };
  }
}
