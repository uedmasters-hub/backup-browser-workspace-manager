export default class SearchNormalizer {
  static normalize(
    input: string
  ): string {
    return input
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
}