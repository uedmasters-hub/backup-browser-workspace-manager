import { extractDomain } from "../util/url";

import type { RawBookmark } from "../../browser/services/bookmarkService";
import type { SearchableBookmark } from "../entities";

export default class BookmarkMapper {
  map(bookmark: RawBookmark): SearchableBookmark {
    const domain = extractDomain(bookmark.url);

    return {
      id: `bookmark-${bookmark.id}`,
      source: "bookmark",
      title: bookmark.title || domain || bookmark.url,
      subtitle: bookmark.folder
        ? `${bookmark.folder} · ${domain}`
        : domain,
      description: bookmark.url,
      keywords: [],
      tags: bookmark.folder ? [bookmark.folder] : [],
      aliases: [],
      searchIndex: [bookmark.title, domain, bookmark.url]
        .join(" ")
        .toLowerCase(),
      createdAt: bookmark.dateAdded,
      bookmarkId: bookmark.id,
      url: bookmark.url,
      folder: bookmark.folder,
    };
  }

  mapMany(bookmarks: RawBookmark[]) {
    return bookmarks.map((b) => this.map(b));
  }
}
