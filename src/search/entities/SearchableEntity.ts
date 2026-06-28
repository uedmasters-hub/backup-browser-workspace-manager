import type {
  SearchSource,
} from "../models";

export interface SearchableEntity {
  id: string;

  source: SearchSource;

  title: string;

  subtitle?: string;

  description?: string;

  keywords: string[];

  tags: string[];

  aliases: string[];

  searchIndex: string;

  createdAt?: number;

  updatedAt?: number;

  lastAccessedAt?: number;

  metadata?: Record<
    string,
    unknown
  >;
}