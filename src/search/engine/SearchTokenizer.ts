export default class SearchTokenizer {
  static tokenize(
    input: string
  ): string[] {
    return input
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }
}