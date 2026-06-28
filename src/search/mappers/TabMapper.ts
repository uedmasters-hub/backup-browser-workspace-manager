import type {
  WorkspaceTab,
} from "../../types/tab";

import type {
  SearchableTab,
} from "../entities";

import type {
  BaseMapper,
} from "./BaseMapper";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export default class TabMapper
  implements BaseMapper<WorkspaceTab, SearchableTab>
{
  map(tab: WorkspaceTab): SearchableTab {
    const domain = extractDomain(tab.url);

    return {
      id: `tab-${tab.id}`,

      source: "tab",

      title: tab.title || domain || tab.url,

      subtitle: domain,

      description: tab.url,

      keywords: [],

      tags: [],

      aliases: [],

      searchIndex: [tab.title, domain, tab.url]
        .join(" ")
        .toLowerCase()
        .trim(),

      lastAccessedAt: tab.lastAccessed,

      tabId: tab.id,

      windowId: tab.windowId,

      url: tab.url,

      domain,

      favorite: tab.favorite,

      pinned: tab.pinned,

      active: tab.active,

      metadata: {
        favicon: tab.favicon,
        audible: tab.audible,
      },
    };
  }

  mapMany(tabs: WorkspaceTab[]) {
    return tabs.map((tab) => this.map(tab));
  }
}
