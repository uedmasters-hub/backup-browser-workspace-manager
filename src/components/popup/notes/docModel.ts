/**
 * A note as a flat list of formatted paragraphs — the shared middle step for
 * the Word (.docx) and Rich Text (.rtf) downloads.
 *
 * Only what the editor can produce is read (bold, italic, underline, strike,
 * highlight, inline code, links, sizes, headings, lists, quotes, code blocks,
 * alignment, line spacing); everything else in stored HTML is reduced to its
 * text. Link targets go through the same allow-list as the other exports.
 */
import { blockHtml } from "./richText";

import type { CalloutTone, Note, NoteBlock } from "../../../types/notes";

export type FontSize = "small" | "large" | "huge";

export interface DocRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  highlight?: boolean;
  code?: boolean;
  muted?: boolean;
  size?: FontSize;
  /** Only http(s) / mailto targets survive. */
  href?: string;
  /** A line break (Shift+Enter) — `text` is ignored. */
  lineBreak?: boolean;
}

export interface DocList {
  ordered: boolean;
  /** 0 = top level. */
  level: number;
  /** Same id for every item of one list (ordered lists restart per id). */
  listId: number;
  /** The visible number of an ordered item ("3"). */
  number: number;
  /** First paragraph of the item carries the marker; later ones just indent. */
  marker: boolean;
}

export type DocKind = "title" | "meta" | "body" | "h1" | "h2" | "h3" | "code" | "divider";

export interface DocParagraph {
  kind: DocKind;
  runs: DocRun[];
  align?: "center" | "right" | "justify";
  spacing?: "compact" | "relaxed" | "double";
  list?: DocList;
  /** Nesting depth of block quotes. */
  quote?: number;
  callout?: CalloutTone;
  /** Checklist item: the box is drawn by the writer. */
  check?: { done: boolean };
  /** First paragraph of a note block — gets a little room above it. */
  blockStart?: boolean;
}

export interface DocModel {
  title: string;
  updatedAt: number;
  paragraphs: DocParagraph[];
}

// ───────────────────────── helpers ─────────────────────────

export function safeHref(href: string | null | undefined): string | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(href.trim());
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

function hostOf(href: string): string {
  try {
    return new URL(href).host;
  } catch {
    return "";
  }
}

export function formatUpdated(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Never exported, not even as text. */
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH", "IMG"]);
const BLOCK_TAGS = /^(P|DIV|H[1-6]|UL|OL|LI|BLOCKQUOTE|PRE)$/;

type Marks = Omit<DocRun, "text" | "lineBreak">;

function inlineRuns(node: Node, marks: Marks, out: DocRun[], pre = false): void {
  if (node.nodeType === Node.TEXT_NODE) {
    let text = node.textContent ?? "";
    if (!pre) text = text.replace(/[\r\n]+/g, " ");
    if (!text) return;
    if (pre) {
      // Code blocks keep their lines.
      text.split("\n").forEach((line, i) => {
        if (i > 0) out.push({ text: "", lineBreak: true });
        if (line) out.push({ ...marks, text: line });
      });
      return;
    }
    out.push({ ...marks, text });
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (DROP_TAGS.has(el.tagName)) return;
  if (el.tagName === "BR") {
    out.push({ text: "", lineBreak: true });
    return;
  }
  const next: Marks = { ...marks };
  switch (el.tagName) {
    case "STRONG":
    case "B":
      next.bold = true;
      break;
    case "EM":
    case "I":
      next.italic = true;
      break;
    case "U":
      next.underline = true;
      break;
    case "S":
    case "DEL":
    case "STRIKE":
      next.strike = true;
      break;
    case "MARK":
      next.highlight = true;
      break;
    case "CODE":
      next.code = true;
      break;
    case "A": {
      const href = safeHref(el.getAttribute("href"));
      if (href) next.href = href;
      break;
    }
    case "SPAN": {
      const size = el.getAttribute("data-size");
      if (size === "small" || size === "large" || size === "huge") next.size = size;
      break;
    }
  }
  el.childNodes.forEach((c) => inlineRuns(c, next, out, pre));
}

/** Adjacent runs with the same formatting become one. */
function mergeRuns(runs: DocRun[]): DocRun[] {
  const out: DocRun[] = [];
  const key = (r: DocRun) => JSON.stringify({ ...r, text: "" });
  for (const r of runs) {
    const prev = out[out.length - 1];
    if (prev && !prev.lineBreak && !r.lineBreak && key(prev) === key(r)) prev.text += r.text;
    else out.push({ ...r });
  }
  // Trim the edges of a paragraph (the editor never relies on them).
  const first = out[0];
  if (first && !first.lineBreak) first.text = first.text.replace(/^[ \t]+/, "");
  const last = out[out.length - 1];
  if (last && !last.lineBreak) last.text = last.text.replace(/[ \t]+$/, "");
  return out.filter((r) => r.lineBreak || r.text);
}

function paraStyle(el: Element): Pick<DocParagraph, "align" | "spacing"> {
  const style: Pick<DocParagraph, "align" | "spacing"> = {};
  const align = (el.getAttribute("style") ?? "").match(/text-align:\s*(center|right|justify)/i)?.[1];
  if (align) style.align = align.toLowerCase() as DocParagraph["align"];
  const spacing = el.getAttribute("data-spacing");
  if (spacing === "compact" || spacing === "relaxed" || spacing === "double") style.spacing = spacing;
  return style;
}

interface Ctx {
  quote: number;
  callout?: CalloutTone;
  list?: Omit<DocList, "marker">;
  /** The current list item has already put out its marker paragraph. */
  itemMarked?: { done: boolean };
}

class Builder {
  paragraphs: DocParagraph[] = [];
  private nextListId = 1;

  push(p: Omit<DocParagraph, "quote" | "callout" | "list">, ctx: Ctx): void {
    const para: DocParagraph = { ...p };
    if (ctx.quote) para.quote = ctx.quote;
    if (ctx.callout) para.callout = ctx.callout;
    if (ctx.list) {
      const marker = !ctx.itemMarked?.done;
      para.list = { ...ctx.list, marker };
      if (ctx.itemMarked) ctx.itemMarked.done = true;
    }
    this.paragraphs.push(para);
  }

  /** Inline content of `el` as one paragraph. */
  inline(el: Element, kind: DocKind, ctx: Ctx): void {
    const runs: DocRun[] = [];
    el.childNodes.forEach((c) => inlineRuns(c, {}, runs, kind === "code"));
    this.push({ kind, runs: mergeRuns(runs), ...paraStyle(el) }, ctx);
  }

  block(el: Element, ctx: Ctx): void {
    if (DROP_TAGS.has(el.tagName)) return;
    switch (el.tagName) {
      case "P":
        this.inline(el, "body", ctx);
        return;
      case "H1":
      case "H2":
      case "H3":
        this.inline(el, el.tagName.toLowerCase() as DocKind, ctx);
        return;
      case "H4":
      case "H5":
      case "H6":
        this.inline(el, "h3", ctx);
        return;
      case "PRE":
        this.inline(el, "code", ctx);
        return;
      case "BLOCKQUOTE":
        this.children(el, { ...ctx, quote: ctx.quote + 1 });
        return;
      case "UL":
      case "OL": {
        const ordered = el.tagName === "OL";
        const listId = this.nextListId++;
        const level = ctx.list ? ctx.list.level + 1 : 0;
        const start = ordered ? Number(el.getAttribute("start") ?? 1) || 1 : 1;
        Array.from(el.children)
          .filter((li) => li.tagName === "LI")
          .forEach((li, i) => {
            const item: Ctx = {
              quote: ctx.quote,
              callout: ctx.callout,
              list: { ordered, level, listId, number: start + i },
              itemMarked: { done: false },
            };
            this.children(li, item);
            // An empty item still shows its marker.
            if (!item.itemMarked?.done) this.push({ kind: "body", runs: [] }, item);
          });
        return;
      }
      default:
        this.children(el, ctx);
    }
  }

  /** Block children; loose inline content is gathered into paragraphs. */
  children(el: Element, ctx: Ctx): void {
    let loose: Node[] = [];
    const flush = () => {
      if (!loose.length) return;
      const runs: DocRun[] = [];
      loose.forEach((n) => inlineRuns(n, {}, runs));
      const merged = mergeRuns(runs);
      if (merged.length) this.push({ kind: "body", runs: merged }, ctx);
      loose = [];
    };
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.test((node as Element).tagName)) {
        flush();
        this.block(node as Element, ctx);
      } else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
        loose.push(node);
      }
    });
    flush();
  }

  html(html: string, ctx: Ctx): void {
    const body = new DOMParser().parseFromString(html, "text/html").body;
    this.children(body, ctx);
  }
}

function addBlock(b: Builder, block: NoteBlock): void {
  const startAt = b.paragraphs.length;
  switch (block.type) {
    case "text":
      b.html(blockHtml(block), { quote: 0 });
      break;
    case "callout":
      b.html(blockHtml(block), { quote: 0, callout: block.tone });
      if (b.paragraphs.length === startAt) b.push({ kind: "body", runs: [] }, { quote: 0, callout: block.tone });
      break;
    case "checklist":
      for (const item of block.items) {
        if (!item.text.trim()) continue;
        b.push(
          {
            kind: "body",
            check: { done: item.done },
            runs: [{ text: item.text.trim(), strike: item.done || undefined, muted: item.done || undefined }],
          },
          { quote: 0 }
        );
      }
      break;
    case "link": {
      const href = safeHref(block.url);
      const label = block.label.trim();
      if (!href) {
        if (label || block.url.trim()) b.push({ kind: "body", runs: [{ text: label || block.url.trim() }] }, { quote: 0 });
        break;
      }
      const host = hostOf(href);
      const runs: DocRun[] = [{ text: label || href, href }];
      if (label && host) runs.push({ text: `  ${host}`, muted: true, size: "small" });
      b.push({ kind: "body", runs }, { quote: 0 });
      break;
    }
    case "divider":
      b.push({ kind: "divider", runs: [] }, { quote: 0 });
      break;
    case "password":
      b.push(
        { kind: "body", runs: [{ text: `🔒 ${block.label || "Password"} — encrypted, not included`, muted: true }] },
        { quote: 0 }
      );
      break;
  }
  if (b.paragraphs.length > startAt) b.paragraphs[startAt].blockStart = true;
}

/**
 * The note as a document: title, "Updated …" line, then every block.
 * Pass the note as the editor shows it (a locked note must be revealed first;
 * `note.locked` alone never hides content here — the caller decides).
 */
export function buildDocModel(note: Note): DocModel {
  const title = note.title.trim().replace(/\s+/g, " ") || "Untitled";
  const b = new Builder();
  b.paragraphs.push({ kind: "title", runs: [{ text: title }] });
  b.paragraphs.push({ kind: "meta", runs: [{ text: `Updated ${formatUpdated(note.updatedAt)}`, muted: true }] });
  const bodyStart = b.paragraphs.length;
  note.blocks.forEach((block) => addBlock(b, block));

  // Trailing empty paragraphs (the editor's "type here" line) add nothing.
  while (
    b.paragraphs.length > bodyStart &&
    (() => {
      const p = b.paragraphs[b.paragraphs.length - 1];
      return p.kind === "body" && !p.runs.length && !p.list && !p.callout && !p.check;
    })()
  ) {
    b.paragraphs.pop();
  }
  if (b.paragraphs[bodyStart]) b.paragraphs[bodyStart].blockStart = false;
  return { title, updatedAt: note.updatedAt, paragraphs: b.paragraphs };
}

// ───────────────────────── shared layout numbers ─────────────────────────
// Twips (1/20 pt) and half-points, used by both writers so .docx and .rtf
// look the same.

export const BASE_HALF_POINTS = 22; // 11 pt
export const SIZE_HALF_POINTS: Record<FontSize, number> = { small: 19, large: 26, huge: 33 };
export const KIND_HALF_POINTS: Partial<Record<DocKind, number>> = {
  title: 40,
  meta: 18,
  h1: 32,
  h2: 27,
  h3: 24,
  code: 19,
};
/** Line height, in 240ths of a line. */
export const LINE_240 = { compact: 240, normal: 276, relaxed: 360, double: 480 } as const;

export const LIST_INDENT = 360;
export const QUOTE_INDENT = 360;

/** Left indent / hanging indent for a paragraph. */
export function indentOf(p: DocParagraph): { left: number; hanging: number } {
  let left = (p.quote ?? 0) * QUOTE_INDENT;
  let hanging = 0;
  if (p.callout) left += 160;
  if (p.list) {
    left += LIST_INDENT * (p.list.level + 2);
    if (p.list.marker) hanging = LIST_INDENT;
  }
  if (p.check) {
    left += LIST_INDENT;
    hanging = LIST_INDENT;
  }
  return { left, hanging };
}

/** Space before / after, in twips. */
export function spacingOf(p: DocParagraph): { before: number; after: number } {
  switch (p.kind) {
    case "title":
      return { before: 0, after: 40 };
    case "meta":
      return { before: 0, after: 280 };
    case "h1":
      return { before: 280, after: 80 };
    case "h2":
      return { before: 240, after: 60 };
    case "h3":
      return { before: 200, after: 40 };
    case "divider":
      return { before: 60, after: 180 };
    default:
      return { before: p.blockStart ? 160 : 0, after: p.list || p.check ? 20 : 60 };
  }
}

export const BULLETS = ["•", "◦", "▪"];

/** "1." / "a." / "i." by depth, like Word's default outline. */
export function orderedMarker(n: number, level: number): string {
  switch (level % 3) {
    case 1: {
      let s = "";
      for (let v = n; v > 0; v = Math.floor((v - 1) / 26)) s = String.fromCharCode(97 + ((v - 1) % 26)) + s;
      return `${s || "a"}.`;
    }
    case 2: {
      const table: [number, string][] = [
        [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
        [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
      ];
      let v = Math.max(1, Math.min(n, 3999));
      let s = "";
      for (const [value, sym] of table) while (v >= value) { s += sym; v -= value; }
      return `${s}.`;
    }
    default:
      return `${n}.`;
  }
}

export interface PageSetup {
  /** Twips. */
  width: number;
  height: number;
  margin: number;
}

/** US Letter where it's the norm, A4 everywhere else; 1-inch margins. */
export function pageSetupFor(locale: string | undefined): PageSetup {
  const region = (locale ?? "").split(/[-_]/)[1]?.toUpperCase();
  const letter = ["US", "CA", "MX", "PH", "CL", "CO", "VE", "PR", "GT", "CR", "PA", "DO", "SV", "NI"].includes(region ?? "");
  return letter ? { width: 12240, height: 15840, margin: 1440 } : { width: 11906, height: 16838, margin: 1440 };
}

export const COLORS = {
  text: "262626",
  muted: "8A8A8A",
  link: "4F46E5",
  border: "D4D4D4",
  codeBg: "F4F4F5",
  callout: {
    info: { fill: "EEF2FF", line: "6366F1" },
    warn: { fill: "FFFBEB", line: "F59E0B" },
    success: { fill: "ECFDF5", line: "10B981" },
  },
} as const;
