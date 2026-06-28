import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableSession
  extends SearchableEntity {
  sessionId: string;

  workspaceCount: number;

  tabCount: number;
}