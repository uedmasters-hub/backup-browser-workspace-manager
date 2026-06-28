import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableArchive
  extends SearchableEntity {
  workspaceId: number;

  archivedAt?: number;
}