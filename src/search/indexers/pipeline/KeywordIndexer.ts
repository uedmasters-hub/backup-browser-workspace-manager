export default class KeywordIndexer {
  static generate(
    text: string
  ): string[] {
    return [
      ...new Set(
        text
          .toLowerCase()
          .split(/\W+/)
          .filter(
            (word) =>
              word.length > 2
          )
      ),
    ];
  }
}