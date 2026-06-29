export interface RawBookmark {
  id: string;
  title: string;
  url: string;
  folder?: string;
  dateAdded?: number;
}

/** Flatten the bookmark tree into leaf bookmarks (those with a URL). */
export async function getBookmarks(): Promise<RawBookmark[]> {
  const tree = await chrome.bookmarks.getTree();

  const out: RawBookmark[] = [];

  function walk(
    nodes: chrome.bookmarks.BookmarkTreeNode[],
    folder?: string
  ) {
    for (const node of nodes) {
      if (node.url) {
        out.push({
          id: node.id,
          title: node.title,
          url: node.url,
          folder,
          dateAdded: node.dateAdded,
        });
      }

      if (node.children) {
        walk(node.children, node.title || folder);
      }
    }
  }

  walk(tree);

  return out;
}
