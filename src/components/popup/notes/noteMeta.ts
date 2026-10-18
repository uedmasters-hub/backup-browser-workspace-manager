import type { Note } from "../../../types/notes";

/** First line of content, for list rows. */
export function preview(note: Note): string {
  for (const block of note.blocks) {
    if (block.type === "text" && block.text.trim()) return block.text.trim();
    if (block.type === "callout" && block.text.trim()) return block.text.trim();
    if (block.type === "checklist") {
      const first = block.items.find((i) => i.text.trim());
      if (first) return first.text.trim();
    }
    if (block.type === "link" && (block.label || block.url))
      return block.label || block.url;
    if (block.type === "chart" && block.title.trim()) return block.title.trim();
  }
  return "Empty note";
}

export function ago(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export function matchesQuery(note: Note, q: string): boolean {
  return note.title.toLowerCase().includes(q) || preview(note).toLowerCase().includes(q);
}
