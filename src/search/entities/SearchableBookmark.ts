import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableBookmark
  extends SearchableEntity {
  bookmarkId: string;

  url: string;

  folder?: string;
}