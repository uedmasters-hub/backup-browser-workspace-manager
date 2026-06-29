export interface RawHistoryItem {
  id: string;
  title: string;
  url: string;
  lastVisitTime?: number;
  visitCount?: number;
}

export async function searchHistory(
  text: string,
  maxResults = 50
): Promise<RawHistoryItem[]> {
  const items = await chrome.history.search({
    text,
    maxResults,
    startTime: 0,
  });

  return items
    .filter((item) => !!item.url)
    .map((item) => ({
      id: item.id,
      title: item.title ?? item.url ?? "",
      url: item.url ?? "",
      lastVisitTime: item.lastVisitTime,
      visitCount: item.visitCount,
    }));
}
