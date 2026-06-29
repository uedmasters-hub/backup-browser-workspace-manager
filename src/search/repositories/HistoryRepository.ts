import { searchHistory } from "../../browser/services/historyService";
import HistoryMapper from "../mappers/HistoryMapper";
import type { SearchableHistory } from "../entities";

export default class HistoryRepository {
  // History is large, so it is queried by text directly at the source.
  static async search(
    text: string,
    maxResults = 50
  ): Promise<SearchableHistory[]> {
    const items = await searchHistory(text, maxResults);
    return new HistoryMapper().mapMany(items);
  }
}
