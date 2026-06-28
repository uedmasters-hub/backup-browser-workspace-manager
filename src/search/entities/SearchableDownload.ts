import type {
  SearchableEntity,
} from "./SearchableEntity";

export interface SearchableDownload
  extends SearchableEntity {
  downloadId: number;

  filename: string;

  extension: string;

  url: string;
}