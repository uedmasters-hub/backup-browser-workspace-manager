import { STORAGE_KEYS } from "../../constants/storageKeys";

export async function getFavoriteTabUrls(): Promise<string[]> {
  const result = await chrome.storage.local.get(
    STORAGE_KEYS.FAVORITE_TABS
  );

  const urls = result[
    STORAGE_KEYS.FAVORITE_TABS
  ] as unknown;

  if (!Array.isArray(urls)) {
    return [];
  }

  return urls.filter(
    (url): url is string =>
      typeof url === "string" && url.length > 0
  );
}

export async function setTabFavorite(
  url: string,
  favorite: boolean
): Promise<void> {
  if (!url) {
    return;
  }

  const urls = new Set(
    await getFavoriteTabUrls()
  );

  if (favorite) {
    urls.add(url);
  } else {
    urls.delete(url);
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.FAVORITE_TABS]: [...urls],
  });
}
