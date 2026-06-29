import { getAllTabs } from "../../browser/services/tabService";
import { getFavoriteTabUrls } from "../../browser/storage/tabFavoriteRepository";

import TabMapper from "../mappers/TabMapper";

import type { SearchableTab } from "../entities";

export default class TabRepository {
  static async getAll(): Promise<SearchableTab[]> {
    const [tabs, favoriteUrls] = await Promise.all([
      getAllTabs(),
      getFavoriteTabUrls(),
    ]);

    const favorites = new Set(favoriteUrls);

    const annotated = tabs.map((tab) => ({
      ...tab,
      favorite: favorites.has(tab.url),
    }));

    return new TabMapper().mapMany(annotated);
  }
}
