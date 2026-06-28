/**
 * SearchScorer
 *
 * The relevance core of the search engine. Given a tokenized query and a set of
 * weighted fields for a candidate record, it produces a normalized score plus
 * the metadata needed to render highlights.
 *
 * Match quality is tiered, from strongest to weakest:
 *
 *   1.0  exact      field value equals the token
 *   0.92 prefix     field value starts with the token
 *   0.82 wordPrefix a word inside the field starts with the token
 *   0.6  substring  the token appears somewhere in the field
 *   0..0.4 fuzzy    the token's characters appear in order (subsequence),
 *                   scaled by how tightly they are packed
 *
 * A query made of multiple tokens is an AND match: every token must hit at
 * least one field, otherwise the record is rejected. The final score is the
 * weighted average of each token's best field hit, plus a bonus when the whole
 * query appears contiguously in a field.
 */

export interface ScorerField {
  name: string;
  value: string;
  weight: number;
}

export interface ScoredMatch {
  score: number;
  matchedFields: string[];
  highlights: string[];
}

const TIER = {
  exact: 1.0,
  prefix: 0.92,
  wordPrefix: 0.82,
  substring: 0.6,
} as const;

const CONTIGUOUS_BONUS = 0.25;

export default class SearchScorer {
  /**
   * Score a single token against a single (already lowercased) field value.
   * Returns a value in [0, 1]; 0 means no match.
   */
  static scoreToken(token: string, value: string): number {
    if (!token || !value) {
      return 0;
    }

    if (value === token) {
      return TIER.exact;
    }

    if (value.startsWith(token)) {
      return TIER.prefix;
    }

    if (SearchScorer.hasWordPrefix(value, token)) {
      return TIER.wordPrefix;
    }

    const indexOf = value.indexOf(token);

    if (indexOf >= 0) {
      // Slightly favor matches that occur earlier in the field.
      const positionPenalty = Math.min(indexOf / value.length, 0.15);
      return TIER.substring - positionPenalty * 0.2;
    }

    return SearchScorer.fuzzyScore(token, value);
  }

  /**
   * Score every token against every field and combine.
   * Returns null when the record is not a match at all.
   */
  static scoreFields(
    tokens: string[],
    fullQuery: string,
    fields: ScorerField[]
  ): ScoredMatch | null {
    const normalizedFields = fields.map((field) => ({
      ...field,
      value: field.value.toLowerCase(),
    }));

    const matchedFields = new Set<string>();
    const highlights = new Set<string>();

    let weightedSum = 0;

    for (const token of tokens) {
      let bestScore = 0;
      let bestField: string | null = null;

      for (const field of normalizedFields) {
        const raw = SearchScorer.scoreToken(token, field.value);

        if (raw <= 0) {
          continue;
        }

        const weighted = raw * field.weight;

        if (weighted > bestScore) {
          bestScore = weighted;
          bestField = field.name;
        }
      }

      // Strict AND: a token that matches nothing rejects the record.
      if (bestScore <= 0 || !bestField) {
        return null;
      }

      weightedSum += bestScore;
      matchedFields.add(bestField);
      highlights.add(token);
    }

    if (tokens.length === 0) {
      return null;
    }

    let score = weightedSum / tokens.length;

    // Reward records where the entire query appears contiguously.
    if (fullQuery.length > 0) {
      const contiguous = normalizedFields.some((field) =>
        field.value.includes(fullQuery)
      );

      if (contiguous) {
        score += CONTIGUOUS_BONUS;
      }
    }

    return {
      score,
      matchedFields: Array.from(matchedFields),
      highlights: Array.from(highlights),
    };
  }

  private static hasWordPrefix(value: string, token: string): boolean {
    const words = value.split(/[\s\-_/.:|]+/);
    return words.some((word) => word.startsWith(token));
  }

  /**
   * Subsequence match: do the characters of `token` appear in `value` in order?
   * Score is scaled by how compact the matched span is, so "gh" scores higher
   * against "github" than against "graph theory".
   */
  private static fuzzyScore(token: string, value: string): number {
    if (token.length < 2) {
      return 0;
    }

    let tokenIndex = 0;
    let firstHit = -1;
    let lastHit = -1;

    for (
      let i = 0;
      i < value.length && tokenIndex < token.length;
      i++
    ) {
      if (value[i] === token[tokenIndex]) {
        if (firstHit === -1) {
          firstHit = i;
        }
        lastHit = i;
        tokenIndex++;
      }
    }

    if (tokenIndex < token.length) {
      return 0;
    }

    const span = lastHit - firstHit + 1;
    const density = token.length / span;

    // Cap fuzzy below a real substring hit so it never outranks one.
    return Math.min(density * 0.4, 0.4);
  }
}
