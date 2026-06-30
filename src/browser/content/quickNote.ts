/** Pure helpers for the floating quick note (shared with tests). */

export interface StoredNote {
  id: string;
  title: string;
  blocks: { id: string; type: "text"; text: string }[];
  createdAt: number;
  updatedAt: number;
}

/** Turn the quick-note text into a Note: the body keeps the full text; the
 * title is the first non-empty line (leading blank lines are trimmed). */
export function buildNoteFromText(text: string): StoredNote {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  const now = Date.now();

  let title = "Quick note";
  let bodyLines: string[] = [""];
  if (firstIdx !== -1) {
    title = lines[firstIdx].trim().slice(0, 80);
    // Keep every line from the first real content onward in the body.
    bodyLines = lines.slice(firstIdx);
  }

  return {
    id: crypto.randomUUID(),
    title,
    blocks: bodyLines.map((line) => ({
      id: crypto.randomUUID(),
      type: "text",
      text: line,
    })),
    createdAt: now,
    updatedAt: now,
  };
}
