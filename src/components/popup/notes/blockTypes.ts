import {
  AlignLeft,
  ChartColumn,
  Image,
  Table,
  Lock,
  ListChecks,
  Link2,
  MessageSquareText,
  Minus,
} from "lucide-react";

import type { NoteBlock, NoteBlockType } from "../../../types/notes";

/**
 * What the "/" menu can add: a block of its own, or — for pictures and
 * tables — content placed right where you typed "/" inside the text.
 */
export type SlashType = NoteBlockType | "image" | "table";

export interface BlockTypeMeta {
  type: SlashType;
  label: string;
  hint: string;
  keywords: string[];
  Icon: typeof AlignLeft;
}

export const BLOCK_TYPES: BlockTypeMeta[] = [
  { type: "text", label: "Text", hint: "Plain note", keywords: ["text", "paragraph", "p"], Icon: AlignLeft },
  { type: "checklist", label: "Checklist", hint: "Track to-dos", keywords: ["todo", "task", "check", "list"], Icon: ListChecks },
  { type: "image", label: "Image", hint: "Choose, paste or drop a picture", keywords: ["image", "picture", "photo", "screenshot", "img"], Icon: Image },
  { type: "table", label: "Table", hint: "Rows and columns", keywords: ["table", "grid", "rows", "columns", "spreadsheet"], Icon: Table },
  { type: "chart", label: "Chart", hint: "Bar, line or pie", keywords: ["chart", "graph", "bar", "line", "pie", "plot"], Icon: ChartColumn },
  { type: "callout", label: "Callout", hint: "Highlight a note", keywords: ["callout", "note", "info", "warn"], Icon: MessageSquareText },
  { type: "link", label: "Link", hint: "Save a URL", keywords: ["url", "link", "bookmark"], Icon: Link2 },
  { type: "divider", label: "Divider", hint: "Separate sections", keywords: ["divider", "hr", "line", "separator"], Icon: Minus },
  { type: "password", label: "Password", hint: "PIN-protected", keywords: ["password", "secret", "pin", "secure"], Icon: Lock },
];

export function filterBlockTypes(query: string): BlockTypeMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return BLOCK_TYPES;
  return BLOCK_TYPES.filter(
    (b) =>
      b.label.toLowerCase().includes(q) ||
      b.keywords.some((k) => k.includes(q))
  );
}

/**
 * True while a block holds nothing the user wrote — only its placeholder.
 * Empty blocks get no hover toolbar (copy / move / delete); Backspace clears
 * them instead. A divider is its own content, so it's never "empty".
 */
export function isBlockEmpty(block: NoteBlock): boolean {
  switch (block.type) {
    case "text":
    case "callout":
      return block.text.trim() === "";
    case "checklist":
      return block.items.every((i) => i.text.trim() === "");
    case "link":
      return block.label.trim() === "" && block.url.trim() === "";
    case "password":
      return !block.cipher && (block.label ?? "").trim() === "";
    case "divider":
      return false;
    case "chart":
      return !block.title.trim() && block.points.every((p) => !p.label.trim() && p.value === null);
  }
}
