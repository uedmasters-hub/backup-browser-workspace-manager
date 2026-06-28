import type {
  SearchSource,
} from "./SearchTypes";

import type {
  SearchAction,
} from "./SearchAction";

export interface SearchResult {
  id: string;

  source: SearchSource;

  title: string;

  subtitle?: string;

  description?: string;

  icon?: string;

  score: number;

  matchedText?: string;

  matchedFields?: string[];

  highlights?: string[];

  timestamp?: number;

  actions: SearchAction[];

  payload: unknown;
}