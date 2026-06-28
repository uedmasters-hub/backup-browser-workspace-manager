import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchablePage
  extends SearchableEntity {
  pageId: string;

  tabId: number;

  workspaceId: number;

  url: string;

  headings: string[];

  paragraphs: string[];

  indexed: boolean;
}