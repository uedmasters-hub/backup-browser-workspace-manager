import type { SecretCipher } from "../browser/notes/passwordCrypto";

export type NoteBlockType =
  | "text"
  | "checklist"
  | "link"
  | "password"
  | "callout"
  | "divider"
  | "chart";

interface BaseBlock {
  id: string;
  type: NoteBlockType;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  /** Plain-text mirror — always kept in sync; used for search, previews, export. */
  text: string;
  /** Formatted content (sanitised HTML). Absent on notes written before rich text. */
  html?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ChecklistBlock extends BaseBlock {
  type: "checklist";
  items: ChecklistItem[];
}

export interface LinkBlock extends BaseBlock {
  type: "link";
  label: string;
  url: string;
}

export type CalloutTone = "info" | "warn" | "success";

export interface CalloutBlock extends BaseBlock {
  type: "callout";
  text: string;
  /** Formatted content; absent on older callouts. */
  html?: string;
  tone: CalloutTone;
}

export interface DividerBlock extends BaseBlock {
  type: "divider";
}

/** Secret is encrypted at rest with a per-block PIN (AES-GCM + PBKDF2). */
export interface PasswordBlock extends BaseBlock {
  type: "password";
  label: string;
  hint?: string;
  cipher?: string;
  iv?: string;
  salt?: string;
}

export type ChartKind = "bar" | "line" | "pie";

export interface ChartPoint {
  id: string;
  label: string;
  /** null = not filled in yet. */
  value: number | null;
}

/** A small chart drawn from a list of labelled values. */
export interface ChartBlock extends BaseBlock {
  type: "chart";
  kind: ChartKind;
  title: string;
  points: ChartPoint[];
}

export type NoteBlock =
  | TextBlock
  | ChecklistBlock
  | LinkBlock
  | CalloutBlock
  | DividerBlock
  | PasswordBlock
  | ChartBlock;

/** A folder-like group of related notes (e.g. one product or initiative). */
export interface NoteProject {
  id: string;
  name: string;
  /** Accent colour for the project's icon (hex). */
  color: string;
  /** Locked with a PIN: its notes (titles + content) live only inside `sealed`. */
  locked?: boolean;
  /** AES-GCM ciphertext of JSON.stringify(notes in the project). */
  sealed?: SecretCipher;
  createdAt: number;
  updatedAt: number;
}

export interface Note {
  id: string;
  title: string;
  /** The project this note belongs to; absent for standalone notes. */
  projectId?: string;
  blocks: NoteBlock[];
  createdAt: number;
  updatedAt: number;
  /** When true, blocks are encrypted at rest in `cipher`. */
  locked?: boolean;
  /** AES-GCM ciphertext of JSON.stringify(blocks) when locked. */
  cipher?: SecretCipher;
}
