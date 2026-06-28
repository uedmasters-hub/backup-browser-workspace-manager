export default class SearchIndexBuilder {
  static build(
    ...parts: Array<
      string | undefined
    >
  ): string {
    return parts
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .trim();
  }
}