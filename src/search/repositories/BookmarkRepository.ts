import { getBookmarks } from "../../browser/services/bookmarkService";
import BookmarkMapper from "../mappers/BookmarkMapper";
import type { SearchableBookmark } from "../entities";

export default class BookmarkRepository {
  static async getAll(): Promise<SearchableBookmark[]> {
    const bookmarks = await getBookmarks();
    return new BookmarkMapper().mapMany(bookmarks);
  }
}
