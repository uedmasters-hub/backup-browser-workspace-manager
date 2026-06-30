/** Pure helpers for the floating quick note (shared with tests). */

export interface StoredNote {
  id: string;
  title: string;
  blocks: { id: string; type: "text"; text: string }[];
  createdAt: number;
  updatedAt: number;
}

/** Build a Note whose title is the note's name and whose body holds the full
 * quick-note text (one text block per line). */
export function buildNoteFromText(
  text: string,
  title = "Quick note"
): StoredNote {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const bodyLines = text.trim().length > 0 ? lines : [""];
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    title: (title.trim() || "Quick note").slice(0, 100),
    blocks: bodyLines.map((line) => ({
      id: crypto.randomUUID(),
      type: "text",
      text: line,
    })),
    createdAt: now,
    updatedAt: now,
  };
}
