import type {
  SearchResult,
} from "./SearchResult";

export interface SearchSection {
  id: string;

  title: string;

  results: SearchResult[];
}