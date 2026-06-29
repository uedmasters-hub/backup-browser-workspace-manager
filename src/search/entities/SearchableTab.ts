import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableTab
  extends SearchableEntity {
  tabId: number;

  windowId: number;

  url: string;

  domain: string;

  pinned: boolean;

  active: boolean;

  favorite: boolean;
}