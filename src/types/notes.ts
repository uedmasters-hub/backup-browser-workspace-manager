import type { SecretCipher } from "../browser/notes/passwordCrypto";

export type NoteBlockType =
  | "text"
  | "checklist"
  | "link"
  | "password"
  | "callout"
  | "divider";

interface BaseBlock {
  id: string;
  type: NoteBlockType;
}

export interface TextBlock extends BaseBlock {
  type: "text";
  text: string;
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

export type NoteBlock =
  | TextBlock
  | ChecklistBlock
  | LinkBlock
  | CalloutBlock
  | DividerBlock
  | PasswordBlock;

export interface Note {
  id: string;
  title: string;
  blocks: NoteBlock[];
  createdAt: number;
  updatedAt: number;
  /** Optional PIN lock. When set, deleting the note requires the PIN. */
  lock?: SecretCipher;
}
