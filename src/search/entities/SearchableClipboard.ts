import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableClipboard
  extends SearchableEntity {
  clipboardId: string;

  copiedAt: number;
}