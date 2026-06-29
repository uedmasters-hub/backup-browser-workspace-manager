import {
  AlignLeft,
  Lock,
  ListChecks,
  Link2,
  MessageSquareText,
  Minus,
} from "lucide-react";

import type { NoteBlockType } from "../../../types/notes";

export interface BlockTypeMeta {
  type: NoteBlockType;
  label: string;
  hint: string;
  keywords: string[];
  Icon: typeof AlignLeft;
}

export const BLOCK_TYPES: BlockTypeMeta[] = [
  { type: "text", label: "Text", hint: "Plain note", keywords: ["text", "paragraph", "p"], Icon: AlignLeft },
  { type: "checklist", label: "Checklist", hint: "Track to-dos", keywords: ["todo", "task", "check", "list"], Icon: ListChecks },
  { type: "link", label: "Link", hint: "Save a URL", keywords: ["url", "link", "bookmark"], Icon: Link2 },
  { type: "password", label: "Password", hint: "PIN-protected", keywords: ["password", "secret", "pin", "secure"], Icon: Lock },
  { type: "callout", label: "Callout", hint: "Highlight a note", keywords: ["callout", "note", "info", "warn"], Icon: MessageSquareText },
  { type: "divider", label: "Divider", hint: "Separate sections", keywords: ["divider", "hr", "line", "separator"], Icon: Minus },
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
