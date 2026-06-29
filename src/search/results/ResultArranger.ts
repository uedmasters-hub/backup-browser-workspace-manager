import type { SearchResult, SearchSource } from "../models";

import { normalizeUrl } from "../util/url";

import {
  SECTION_ORDER,
  SECTION_CAPS,
  GLOBAL_CAP,
} from "./sectionConfig";

/**
 * Turns a flat list of scored results into the final display order:
 *   1. de-duplicate by URL across sources (keep the highest-scored row)
 *   2. sort each source's results by score, capped per source
 *   3. concatenate sources in a fixed, scannable order
 *   4. apply a global cap
 *
 * The output is still a flat array, so keyboard navigation indexes straight
 * into it; section headers are derived at render time from `source` changes.
 */
export default class ResultArranger {
  static arrange(results: SearchResult[]): SearchResult[] {
    const deduped = ResultArranger.dedupeByUrl(results);

    const bySource = new Map<SearchSource, SearchResult[]>();

    for (const result of deduped) {
      const list = bySource.get(result.source) ?? [];
      list.push(result);
      bySource.set(result.source, list);
    }

    const arranged: SearchResult[] = [];

    for (const source of SECTION_ORDER) {
      const list = bySource.get(source);
      if (!list) {
        continue;
      }

      list.sort((a, b) => b.score - a.score);
      arranged.push(...list.slice(0, SECTION_CAPS[source]));
    }

    return arranged.slice(0, GLOBAL_CAP);
  }

  /** Same page from multiple sources collapses to its highest-scored row. */
  private static dedupeByUrl(
    results: SearchResult[]
  ): SearchResult[] {
    const best = new Map<string, SearchResult>();
    const passthrough: SearchResult[] = [];

    for (const result of results) {
      const url = ResultArranger.urlOf(result);

      if (!url) {
        passthrough.push(result);
        continue;
      }

      const key = normalizeUrl(url);
      const existing = best.get(key);

      if (!existing || result.score > existing.score) {
        best.set(key, result);
      }
    }

    return [...passthrough, ...best.values()];
  }

  private static urlOf(result: SearchResult): string | undefined {
    const payload = result.payload as { url?: string } | undefined;
    return payload?.url;
  }
}
