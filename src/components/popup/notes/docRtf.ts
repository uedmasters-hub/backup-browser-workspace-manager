/**
 * DocModel → Rich Text Format (.rtf). Opens in Word, Pages, TextEdit,
 * WordPad and LibreOffice. Pure string building — no browser APIs.
 */
import {
  BASE_HALF_POINTS,
  BULLETS,
  COLORS,
  KIND_HALF_POINTS,
  LINE_240,
  SIZE_HALF_POINTS,
  contentWidth,
  imageTwips,
  indentOf,
  orderedMarker,
  spacingOf,
  tableGrid,
} from "./docModel";

import type { DocImage, DocModel, DocParagraph, DocRun, DocTable, PageSetup } from "./docModel";

/** Text → RTF: specials escaped, everything past ASCII as \uN? (UTF-16 units). */
export function rtfEscape(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    const ch = text[i];
    if (ch === "\\" || ch === "{" || ch === "}") out += "\\" + ch;
    else if (ch === "\t") out += "\\tab ";
    else if (ch === "\n") out += "\\line ";
    else if (c < 0x20 || c === 0x7f) continue;
    else if (c < 0x80) out += ch;
    else out += `\\u${c > 0x7fff ? c - 0x10000 : c}?`;
  }
  return out;
}

function hexToRtf(hex: string): string {
  const n = parseInt(hex, 16);
  return `\\red${(n >> 16) & 255}\\green${(n >> 8) & 255}\\blue${n & 255};`;
}

// Colour table (index 0 = automatic).
const PALETTE = [
  COLORS.text, // 1
  COLORS.muted, // 2
  COLORS.link, // 3
  "FDE68A", // 4 highlight
  COLORS.codeBg, // 5
  COLORS.border, // 6
  COLORS.callout.info.fill, // 7
  COLORS.callout.info.line, // 8
  COLORS.callout.warn.fill, // 9
  COLORS.callout.warn.line, // 10
  COLORS.callout.success.fill, // 11
  COLORS.callout.success.line, // 12
];
const C = { text: 1, muted: 2, link: 3, highlight: 4, codeBg: 5, border: 6 };
const CALLOUT_C = { info: [7, 8], warn: [9, 10], success: [11, 12] } as const;

const F = { body: 0, mono: 1, symbol: 2 };

function runProps(run: DocRun, base: number, inCode: boolean): string {
  let p = `\\f${run.code || inCode ? F.mono : F.body}`;
  p += `\\fs${run.size ? SIZE_HALF_POINTS[run.size] : base}`;
  if (run.bold) p += "\\b";
  if (run.italic) p += "\\i";
  if (run.underline || run.href) p += "\\ul";
  if (run.strike) p += "\\strike";
  if (run.highlight) p += `\\highlight${C.highlight}`;
  if (run.code && !inCode) p += `\\chcbpat${C.codeBg}`;
  p += `\\cf${run.href ? C.link : run.muted ? C.muted : C.text}`;
  return p;
}

function runsRtf(runs: DocRun[], base: number, inCode: boolean): string {
  let out = "";
  let i = 0;
  while (i < runs.length) {
    const run = runs[i];
    if (run.lineBreak) {
      out += "\\line ";
      i++;
      continue;
    }
    if (run.href) {
      // One field per link, even when its text has several styles.
      const href = run.href;
      let inner = "";
      while (i < runs.length && runs[i].href === href && !runs[i].lineBreak) {
        inner += `{${runProps(runs[i], base, inCode)} ${rtfEscape(runs[i].text)}}`;
        i++;
      }
      out += `{\\field{\\*\\fldinst{HYPERLINK "${rtfEscape(href.replace(/"/g, "%22"))}"}}{\\fldrslt{${inner}}}}`;
      continue;
    }
    out += `{${runProps(run, base, inCode)} ${rtfEscape(run.text)}}`;
    i++;
  }
  return out;
}

function base64ToHex(base64: string): string {
  const bin = atob(base64);
  let hex = "";
  for (let i = 0; i < bin.length; i++) {
    hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
    if (i % 64 === 63) hex += "\n";
  }
  return hex;
}

/** PNG / JPEG picture; GIFs (no RTF form) fall back to their label. */
function pictureRtf(image: DocImage, maxWidth: number): string {
  if (image.mime === "gif") return `{\\i\\cf${C.muted} ${rtfEscape(`[Image${image.alt ? `: ${image.alt}` : ""}]`)}}`;
  const size = imageTwips(image, maxWidth);
  const blip = image.mime === "png" ? "\\pngblip" : "\\jpegblip";
  return (
    `{\\pict${blip}\\picw${Math.round(image.width)}\\pich${Math.round(image.height)}` +
    `\\picwgoal${size.width}\\pichgoal${size.height}\n${base64ToHex(image.base64)}}`
  );
}

interface Layout {
  /** Room for pictures (twips). */
  maxWidth: number;
}

/** One paragraph; `end` is \par, or \cell for the last one in a table cell. */
function paragraphRtf(p: DocParagraph, layout: Layout, inTable = false, end = "\\par"): string {
  if (p.kind === "table" && p.table) return tableRtf(p.table, layout);

  const base = KIND_HALF_POINTS[p.kind] ?? BASE_HALF_POINTS;
  const { before, after } = inTable ? { before: 0, after: 0 } : spacingOf(p);
  const { left, hanging } = indentOf(p);
  const line = LINE_240[p.spacing ?? "normal"];

  let pp = `\\pard\\plain${inTable ? "\\intbl" : ""}\\sb${before}\\sa${after}\\sl${line}\\slmult1`;
  if (left) pp += `\\li${left}`;
  if (hanging) pp += `\\fi-${hanging}\\tx${left}`;
  pp += p.align ? { center: "\\qc", right: "\\qr", justify: "\\qj" }[p.align] : "\\ql";
  if (p.kind === "h1") pp += "\\outlinelevel0\\keepn";
  if (p.kind === "h2") pp += "\\outlinelevel1\\keepn";
  if (p.kind === "h3") pp += "\\outlinelevel2\\keepn";
  if (p.kind === "title" || p.keepNext) pp += "\\keepn";
  if (p.kind === "code") pp += `\\cbpat${C.codeBg}\\brdrl\\brdrs\\brdrw10\\brdrcf${C.codeBg}\\brsp100`;
  if (p.quote) pp += `\\brdrl\\brdrs\\brdrw20\\brdrcf${C.border}\\brsp120`;
  if (p.callout) {
    const [fill, lineC] = CALLOUT_C[p.callout];
    pp += `\\cbpat${fill}\\brdrl\\brdrs\\brdrw30\\brdrcf${lineC}\\brsp100`;
  }
  if (p.kind === "divider") pp += `\\brdrb\\brdrs\\brdrw10\\brdrcf${C.border}\\brsp20`;

  let marker = "";
  if (p.list?.marker) {
    const text = p.list.ordered ? orderedMarker(p.list.number, p.list.level) : BULLETS[p.list.level % BULLETS.length];
    marker = `{\\f${F.body}\\fs${base}\\cf${C.text} ${rtfEscape(text)}}\\tab `;
  } else if (p.check) {
    marker = `{\\f${F.symbol}\\fs${base}\\cf${p.check.done ? C.link : C.muted} ${rtfEscape(p.check.done ? "☑" : "☐")}}\\tab `;
  }

  if (p.kind === "image" && p.image) return `${pp} ${marker}${pictureRtf(p.image, layout.maxWidth - left)}${end}\n`;
  const runs = p.kind === "title" || p.kind.startsWith("h") ? p.runs.map((r) => ({ ...r, bold: true })) : p.runs;
  return `${pp} ${marker}${runsRtf(runs, base, p.kind === "code")}${end}\n`;
}

/** A table: equal columns across the page, light borders, shaded header cells. */
function tableRtf(table: DocTable, layout: Layout): string {
  const grid = tableGrid(table);
  const colW = Math.floor(layout.maxWidth / grid.cols);
  const border = (side: string) => `\\clbrdr${side}\\brdrs\\brdrw10\\brdrcf${C.border}`;
  let out = "";
  grid.rows.forEach((row, ri) => {
    const header = row.some((s) => s.cell?.header) && row.every((s) => !s.cell || s.cell.header);
    let defs = `\\trowd\\trgaph100\\trleft0\\trautofit1${header && ri === 0 ? "\\trhdr" : ""}`;
    let x = 0;
    for (const slot of row) {
      x += colW * slot.span;
      defs += slot.vmerge === "restart" ? "\\clvmgf" : slot.vmerge === "continue" ? "\\clvmrg" : "";
      defs += border("t") + border("l") + border("b") + border("r");
      if (slot.cell?.header) defs += `\\clcbpat${C.codeBg}`;
      defs += `\\cellx${x}`;
    }
    const cells = row
      .map((slot) => {
        // A table inside a cell is written as lines of text (RTF nesting is fragile).
        const paras = (slot.cell?.paragraphs ?? [{ kind: "body" as const, runs: [] }]).flatMap((p) =>
          p.kind === "table" && p.table
            ? p.table.rows.map((r): DocParagraph => ({
                kind: "body",
                runs: [{ text: r.cells.map((c) => c.paragraphs.flatMap((q) => q.runs.map((x) => x.text)).join(" ")).join(" | ") }],
              }))
            : [p]
        );
        const inner = { maxWidth: colW * slot.span - 200 };
        return paras
          .map((p, i) => {
            const q = slot.cell?.header ? { ...p, runs: p.runs.map((r) => ({ ...r, bold: true })) } : p;
            return paragraphRtf({ ...q, blockStart: false }, inner, true, i === paras.length - 1 ? "\\cell" : "\\par");
          })
          .join("");
      })
      .join("");
    out += `{${defs}\n${cells}\\row}\n`;
  });
  // Room after the table before what follows.
  return `${out}\\pard\\plain\\sa60\\fs8\\par\n`;
}

function rtfDate(ts: number): string {
  const d = new Date(ts);
  return `\\yr${d.getFullYear()}\\mo${d.getMonth() + 1}\\dy${d.getDate()}\\hr${d.getHours()}\\min${d.getMinutes()}`;
}

export function docToRtf(doc: DocModel, page: PageSetup, exportedAt = Date.now()): string {
  const header = [
    "{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1",
    "{\\fonttbl{\\f0\\fswiss\\fcharset0 Calibri;}{\\f1\\fmodern\\fcharset0 Consolas;}{\\f2\\fnil\\fcharset0 Segoe UI Symbol;}}",
    `{\\colortbl;${PALETTE.map(hexToRtf).join("")}}`,
    `{\\info{\\title ${rtfEscape(doc.title)}}{\\creatim${rtfDate(doc.updatedAt)}}{\\revtim${rtfDate(exportedAt)}}}`,
    `\\paperw${page.width}\\paperh${page.height}\\margl${page.margin}\\margr${page.margin}\\margt${page.margin}\\margb${page.margin}`,
    "\\viewkind4\\widowctrl",
  ].join("\n");
  const layout = { maxWidth: contentWidth(page) };
  return `${header}\n${doc.paragraphs.map((p) => paragraphRtf(p, layout)).join("")}}\n`;
}
