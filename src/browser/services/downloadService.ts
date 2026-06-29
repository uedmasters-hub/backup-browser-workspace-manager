export interface RawDownload {
  id: number;
  filename: string;
  url: string;
  finalUrl: string;
  state: string;
  endTime?: string;
  exists: boolean;
}

export async function getDownloads(
  limit = 100
): Promise<RawDownload[]> {
  const items = await chrome.downloads.search({
    limit,
    orderBy: ["-startTime"],
  });

  return items.map((item) => ({
    id: item.id,
    filename: item.filename,
    url: item.url,
    finalUrl: item.finalUrl ?? item.url,
    state: item.state,
    endTime: item.endTime,
    exists: item.exists,
  }));
}

export async function openDownload(id: number): Promise<void> {
  await chrome.downloads.open(id);
}

export async function showDownload(id: number): Promise<void> {
  chrome.downloads.show(id);
}
