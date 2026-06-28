import type {
  SearchMode,
} from "./SearchTypes";

export interface SearchQuery {
  raw: string;

  text: string;

  mode: SearchMode;

  timestamp: number;
}