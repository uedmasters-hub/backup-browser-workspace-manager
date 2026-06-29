import { extractDomain } from "../util/url";

import type { RawHistoryItem } from "../../browser/services/historyService";
import type { SearchableHistory } from "../entities";

export default class HistoryMapper {
  map(item: RawHistoryItem): SearchableHistory {
    const domain = extractDomain(item.url);

    return {
      id: `history-${item.id}`,
      source: "history",
      title: item.title || domain || item.url,
      subtitle: domain,
      description: item.url,
      keywords: [],
      tags: [],
      aliases: [],
      searchIndex: [item.title, domain, item.url]
        .join(" ")
        .toLowerCase(),
      lastAccessedAt: item.lastVisitTime,
      historyId: item.id,
      url: item.url,
      visitCount: item.visitCount ?? 0,
    };
  }

  mapMany(items: RawHistoryItem[]) {
    return items.map((i) => this.map(i));
  }
}
