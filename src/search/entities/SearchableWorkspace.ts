import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableWorkspace
  extends SearchableEntity {
  workspaceId: number;

  chromeWindowId: number;


  archived: boolean;

  tabCount: number;
}