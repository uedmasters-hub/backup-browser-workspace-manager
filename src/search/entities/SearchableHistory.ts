import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableHistory
  extends SearchableEntity {
  historyId: string;

  url: string;

  visitCount: number;
}