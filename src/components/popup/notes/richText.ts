/**
 * Pure helpers for rich-text notes (no browser APIs — unit-tested by
 * scripts/richTextHarness.ts).
 *
 * A Text/Callout block stores formatted content as `html` and always keeps a
 * plain-text mirror in `text`. Everything else in the app (search, previews,
 * export, "is empty" checks) keeps reading `text`, so it all works unchanged.
 */
import { linkify } from "./linkify";

import type { NoteBlock, TextBlock } from "../../../types/notes";

export interface RichPart {
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Escaped text with URLs turned into links. */
function inlineHtml(line: string, markdown = false): string {
  return linkify(line)
    .map((seg) =>
      seg.kind === "link"
        ? `<a href="${escapeHtml(seg.href)}">${escapeHtml(seg.text)}</a>`
        : markdown
          ? inlineMarkdown(escapeHtml(seg.text))
          : escapeHtml(seg.text)
    )
    .join("");
}

/** **bold**, *italic*, `code` in pasted plain text (already escaped). */
function inlineMarkdown(escaped: string): string {
  return escaped
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\*\*(?=\S)([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*(?=\S)([^*\n]+?)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>");
}

/**
 * Notes written before rich text: one paragraph per line (blank lines kept,
 * so the note looks the same), URLs stay clickable. No list detection — an
 * existing note shouldn't change shape just because it was opened.
 */
export function legacyTextToHtml(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => (line ? `<p>${inlineHtml(line)}</p>` : "<p></p>"))
    .join("");
}

/**
 * Plain text being pasted: light structure is recognised (bullets, numbers,
 * #-headings, > quotes, **bold**), runs of blank lines are dropped, stray
 * non-breaking spaces become normal spaces.
 */
const isNumberish = (cell: string) => /^[-+]?[$€£₹¥]?\s*[\d.,]+\s*%?$/.test(cell.trim());

/**
 * Tab-separated rows (copied from a spreadsheet or terminal as plain text)
 * → a table. The first row becomes the header when it's all words over
 * numeric data. Null when the text isn't tabular.
 */
export function tabularTextToHtml(text: string): string | null {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length < 2 || !lines.every((l) => l.includes("\t"))) return null;
  const rows = lines.map((l) => l.split("\t").map((c) => c.trim()));
  const cols = Math.max(...rows.map((r) => r.length));
  if (cols < 2 || cols > 30) return null;
  const header =
    rows[0].every((c) => c && !isNumberish(c)) && rows.slice(1).some((r) => r.some((c) => c && isNumberish(c)));
  const html = rows
    .map((r, i) => {
      const tag = header && i === 0 ? "th" : "td";
      const cells = Array.from({ length: cols }, (_, j) => `<${tag}><p>${r[j] ? inlineHtml(r[j]) : ""}</p></${tag}>`);
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");
  return `<table><tbody>${html}</tbody></table><p></p>`;
}

export function pastedTextToHtml(text: string): string {
  const table = tabularTextToHtml(text);
  if (table) return table;
  const lines = text.replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n");
  const out: string[] = [];
  let list: { kind: "ul" | "ol"; start: number; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const open =
      list.kind === "ol" && list.start !== 1 ? `<ol start="${list.start}">` : `<${list.kind}>`;
    out.push(open + list.items.map((i) => `<li><p>${i}</p></li>`).join("") + `</${list.kind}>`);
    list = null;
  };
  const addItem = (kind: "ul" | "ol", start: number, content: string) => {
    if (!list || list.kind !== kind) {
      flush();
      list = { kind, start, items: [] };
    }
    list.items.push(inlineHtml(content.trim(), true));
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    // Blank lines are dropped; between list items they keep one ("loose") list.
    if (!line.trim()) continue;
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^\s*[-*•‣◦▪]\s+(.+)$/))) {
      addItem("ul", 1, m[1]);
      continue;
    }
    if ((m = line.match(/^\s*(\d{1,3})[.)]\s+(.+)$/))) {
      addItem("ol", Number(m[1]), m[2]);
      continue;
    }
    // Anything that isn't a list item ends the list.
    flush();

    if ((m = line.match(/^(#{1,3})\s+(.+)$/))) {
      const level = m[1].length;
      out.push(`<h${level}>${inlineHtml(m[2].trim(), true)}</h${level}>`);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      out.push(`<blockquote><p>${inlineHtml(m[1].trim(), true)}</p></blockquote>`);
    } else {
      out.push(`<p>${inlineHtml(line.trim(), true)}</p>`);
    }
  }
  flush();
  return out.join("");
}

/** Shape of Tiptap/ProseMirror JSON (only what we read). */
export interface RichJSON {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichJSON[];
}

/**
 * Formatted document → readable plain text: list items keep "• " / "1. "
 * markers (nested lists indented), quotes keep "> ", line breaks kept.
 */
export function docToPlainText(doc: RichJSON): string {
  const inline = (node: RichJSON): string =>
    (node.content ?? [])
      .map((c) =>
        c.type === "text" ? (c.text ?? "") : c.type === "hardBreak" ? "\n" : inline(c)
      )
      .join("");

  const render = (node: RichJSON, indent: string): string[] => {
    switch (node.type) {
      case "paragraph":
      case "heading":
      case "codeBlock":
        return inline(node)
          .split("\n")
          .map((l) => (l ? indent + l : ""));
      case "bulletList":
      case "orderedList": {
        const start = Number(node.attrs?.start ?? 1) || 1;
        return (node.content ?? []).flatMap((item, i) => {
          const marker = node.type === "bulletList" ? "• " : `${start + i}. `;
          const pad = " ".repeat(marker.length);
          const lines = (item.content ?? []).flatMap((c) => render(c, indent + pad));
          if (lines.length === 0) return [indent + marker.trimEnd()];
          lines[0] = indent + marker + lines[0].slice((indent + pad).length);
          return lines;
        });
      }
      case "blockquote":
        return (node.content ?? [])
          .flatMap((c) => render(c, ""))
          .map((l) => `${indent}> ${l}`.trimEnd());
      case "image": {
        const alt = typeof node.attrs?.alt === "string" ? node.attrs.alt.trim() : "";
        return [`${indent}[Image${alt ? `: ${alt}` : ""}]`];
      }
      case "table":
        // One line per row, cells separated by " | ".
        return (node.content ?? []).map(
          (row) =>
            indent +
            (row.content ?? [])
              .map((cell) =>
                (cell.content ?? [])
                  .flatMap((c) => render(c, ""))
                  .join(" ")
                  .replace(/\s+/g, " ")
                  .trim()
              )
              .join(" | ")
        );
      default:
        return (node.content ?? []).flatMap((c) => render(c, indent));
    }
  };

  const lines = render(doc, "");
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join("\n");
}

/** Stored HTML for a text-like block (converted on the fly for older notes). */
export function blockHtml(block: { text: string; html?: string }): string {
  return block.html ?? legacyTextToHtml(block.text);
}

function isTextBlock(block: NoteBlock | undefined): block is TextBlock {
  return block?.type === "text";
}

/**
 * Neighbouring Text blocks become one: a rich Text block holds many
 * paragraphs, so splitting them only stops formatting/selecting across them.
 * Empty ones simply disappear. Keeps the first block's id. Returns the same
 * array (by reference) when there's nothing to merge.
 */
export function mergeTextBlocks(blocks: NoteBlock[]): NoteBlock[] {
  const hasPair = blocks.some((b, i) => isTextBlock(b) && isTextBlock(blocks[i + 1]));
  if (!hasPair) return blocks;

  const out: NoteBlock[] = [];
  for (const block of blocks) {
    const prev = out[out.length - 1];
    if (!isTextBlock(block) || !isTextBlock(prev)) {
      out.push(block);
      continue;
    }
    if (!block.text.trim()) continue; // empty one adds nothing
    if (!prev.text.trim()) {
      out[out.length - 1] = { ...block, id: prev.id };
      continue;
    }
    out[out.length - 1] = {
      ...prev,
      text: `${prev.text}\n${block.text}`,
      html: blockHtml(prev) + blockHtml(block),
    };
  }
  return out;
}
