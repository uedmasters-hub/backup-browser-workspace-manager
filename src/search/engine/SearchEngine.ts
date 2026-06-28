import QueryParser from "../parsers/QueryParser";
import SearchPipeline from "./SearchPipeline";

import type {
  SearchResult,
} from "../models";

export default class SearchEngine {
  static async search(
    input: string
  ): Promise<SearchResult[]> {
    const query =
      QueryParser.parse(
        input
      );

    return SearchPipeline.run(
      query
    );
  }
}