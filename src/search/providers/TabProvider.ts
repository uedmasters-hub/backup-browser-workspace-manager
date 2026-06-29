import type {
  SearchProvider,
} from "./SearchProvider";

import type {
  SearchQuery,
  SearchResult,
} from "../models";

import type {
  SearchableTab,
} from "../entities";

import TabRepository from "../repositories/TabRepository";

import SearchScorer from "../engine/SearchScorer";
import SearchTokenizer from "../engine/SearchTokenizer";
import { recencyBoost } from "../engine/Boosts";

import {
  activateTab,
  closeTabs,
} from "../../browser/services/tabActionService";

const SOURCE_BASE = 95;
const ACTIVE_BOOST = 8;
const PINNED_BOOST = 4;
const FAVORITE_BOOST = 14;
const DISCOVERY_LIMIT = 6;

export default class TabProvider
  implements SearchProvider
{
  readonly source = "tab" as const;

  async search(
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const tabs = await TabRepository.getAll();

    const text = query.text.trim();

    if (!text) {
      return this.discovery(tabs);
    }

    const tokens = SearchTokenizer.tokenize(text);

    // In deep mode the full URL is a first-class field, not a faint signal.
    const urlWeight = query.mode === "deep" ? 0.85 : 0.45;

    const results: SearchResult[] = [];

    for (const tab of tabs) {
      const match = SearchScorer.scoreFields(tokens, text, [
        { name: "title", value: tab.title, weight: 1 },
        { name: "domain", value: tab.domain, weight: 0.7 },
        { name: "url", value: tab.url, weight: urlWeight },
      ]);

      if (!match) {
        continue;
      }

      const score =
        match.score * SOURCE_BASE +
        (tab.favorite ? FAVORITE_BOOST : 0) +
        (tab.active ? ACTIVE_BOOST : 0) +
        (tab.pinned ? PINNED_BOOST : 0) +
        recencyBoost(tab.lastAccessedAt);

      results.push(
        this.toResult(
          tab,
          score,
          match.matchedFields,
          match.highlights
        )
      );
    }

    return results;
  }

  private discovery(
    tabs: SearchableTab[]
  ): SearchResult[] {
    return [...tabs]
      .sort((a, b) => {
        const favDelta =
          Number(b.favorite) - Number(a.favorite);

        if (favDelta !== 0) {
          return favDelta;
        }

        return (b.lastAccessedAt ?? 0) - (a.lastAccessedAt ?? 0);
      })
      .slice(0, DISCOVERY_LIMIT)
      .map((tab, index) =>
        this.toResult(
          tab,
          (tab.favorite ? 70 : 50) +
            recencyBoost(tab.lastAccessedAt) -
            index,
          ["title"],
          []
        )
      );
  }

  private toResult(
    tab: SearchableTab,
    score: number,
    matchedFields: string[],
    highlights: string[]
  ): SearchResult {
    return {
      id: tab.id,

      source: "tab",

      title: tab.title,

      subtitle: tab.domain || tab.url,

      icon:
        (tab.metadata?.favicon as string | undefined) ??
        undefined,

      score,

      matchedFields,

      highlights,

      timestamp: tab.lastAccessedAt,

      payload: tab,

      actions: [
        {
          id: "switch",
          label: "Switch to tab",
          primary: true,
          run: async () => {
            await activateTab(tab.tabId, tab.windowId);

            if (typeof window !== "undefined") {
              window.close();
            }
          },
        },
        {
          id: "close",
          label: "Close tab",
          run: async () => {
            await closeTabs([tab.tabId]);
          },
        },
      ],
    };
  }
}
