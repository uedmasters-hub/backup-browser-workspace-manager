import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableTab
  extends SearchableEntity {
  tabId: number;

  windowId: number;

  url: string;

  domain: string;

  favorite: boolean;

  pinned: boolean;

  active: boolean;
}
