import { getAllTabs } from "../../browser/services/tabService";

import TabMapper from "../mappers/TabMapper";

import type { SearchableTab } from "../entities";

export default class TabRepository {
  static async getAll(): Promise<SearchableTab[]> {
    const tabs = await getAllTabs();

    const mapper = new TabMapper();

    return mapper.mapMany(tabs);
  }
}
