/**
 * Project download: a ZIP with one folder named after the project, holding
 *   - one Markdown file per note (numbered to keep the project's order),
 *   - "images/" — the pictures those Markdown files show, and
 *   - "<Project>.html" — every note, fully formatted (pictures, tables and
 *     charts included), readable in any browser.
 *
 * Locked notes are listed but their content is never written out.
 * Stored note HTML is re-built from an allow-list (never copied raw), and the
 * page carries a strict Content-Security-Policy, so an export can't run code.
 */
import { zipStore, strToU8 } from "../../../browser/backup/zip";
import { blockHtml, escapeHtml } from "./richText";
import { chartData, chartSvg, formatNumber } from "./chart";

import type { CalloutTone, ChartBlock, Note, NoteBlock, NoteProject } from "../../../types/notes";

/**
 * Where a picture goes when a note is written as Markdown: return the
 * relative path it was saved under, or null to write a text placeholder.
 */
export type ImageSink = (src: string, alt: string) => string | null;
let imageSink: ImageSink | null = null;

function imageMd(src: string | null, alt: string): string {
  const path = src ? imageSink?.(src, alt) : null;
  const label = alt.replace(/[[\]\n]/g, " ").trim();
  if (path) return `![${label}](${path})`;
  const web = /^https?:\/\//i.test(src ?? "") ? src : null;
  return web ? `![${label}](${escapeMdUrl(web)})` : `*[Image${label ? `: ${label}` : ""}]*`;
}

// ───────────────────────── file names ─────────────────────────

/** A name that's safe on Windows, macOS and Linux. */
export function safeFileName(name: string, fallback: string): string {
  const cleaned = Array.from(name, (c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c))
    .join("")
    .replace(/[<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .replace(/[. ]+$/, "")
    .slice(0, 80)
    .trim();
  const reserved = /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(cleaned);
  return cleaned && !reserved ? cleaned : fallback;
}

/** "Plan.md", then "Plan (2).md", … — case-insensitively unique. */
export function uniqueFileName(base: string, ext: string, used: Set<string>): string {
  let candidate = `${base}${ext}`;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

// ───────────────────────── HTML → Markdown ─────────────────────────

/** Never exported, not even as text. */
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "TEMPLATE", "NOSCRIPT", "SVG", "MATH"]);

const MD_SPECIAL = /([\\`*_[\]<>])/g;

function inlineMd(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.textContent ?? "").replace(/\u00a0/g, " ").replace(MD_SPECIAL, "\\$1");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as Element;
  if (DROP_TAGS.has(el.tagName)) return "";
  const inner = () => Array.from(el.childNodes).map(inlineMd).join("");
  const wrap = (mark: string) => {
    const text = inner();
    // Markdown emphasis can't start/end with spaces — keep them outside.
    const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    return m[2] ? `${m[1]}${mark}${m[2]}${mark}${m[3]}` : text;
  };
  switch (el.tagName) {
    case "STRONG":
    case "B":
      return wrap("**");
    case "EM":
    case "I":
      return wrap("*");
    case "S":
    case "DEL":
    case "STRIKE":
      return wrap("~~");
    case "U":
      return `<u>${inner()}</u>`;
    case "MARK":
      return `<mark>${inner()}</mark>`;
    case "CODE":
      return "`" + (el.textContent ?? "").replace(/`/g, "\\`") + "`";
    case "BR":
      return "  \n";
    case "IMG":
      return imageMd(el.getAttribute("src"), el.getAttribute("alt") ?? "");
    case "A": {
      const href = safeHref(el.getAttribute("href"));
      const text = inner();
      if (!href) return text;
      return text === escapeMdUrl(href) || el.textContent === href ? `<${href}>` : `[${text}](${escapeMdUrl(href)})`;
    }
    default:
      return inner();
  }
}

function escapeMdUrl(url: string): string {
  // encodeURIComponent leaves ( ) alone, but they'd end a Markdown link early.
  return url.replace(/[()\s]/g, (c) => ({ "(": "%28", ")": "%29" })[c] ?? encodeURIComponent(c));
}

/** Lines that would read as Markdown syntax are escaped. */
function guardLine(line: string): string {
  return /^(#{1,6}\s|>|[-+*]\s|\d+[.)]\s|---|===)/.test(line) ? `\\${line}` : line;
}

function blockMd(el: Element, indent = ""): string[] {
  const children = () => Array.from(el.children).flatMap((c) => blockMd(c, indent));
  switch (el.tagName) {
    case "P":
    case "DIV": {
      const text = Array.from(el.childNodes).map(inlineMd).join("").trim();
      return text ? text.split("\n").map((l, i) => indent + (i === 0 ? guardLine(l) : l)) : [];
    }
    case "H1":
    case "H2":
    case "H3": {
      const text = Array.from(el.childNodes).map(inlineMd).join("").replace(/\s*\n\s*/g, " ").trim();
      return text ? [`${indent}${"#".repeat(Number(el.tagName[1]) + 1)} ${text}`] : [];
    }
    case "UL":
    case "OL": {
      const start = Number(el.getAttribute("start") ?? 1) || 1;
      return Array.from(el.children)
        .filter((li) => li.tagName === "LI")
        .flatMap((li, i) => {
          const marker = el.tagName === "UL" ? "- " : `${start + i}. `;
          const pad = indent + " ".repeat(marker.length);
          const inlineOnly = Array.from(li.childNodes).every(
            (c) => c.nodeType === Node.TEXT_NODE || !/^(P|DIV|UL|OL|BLOCKQUOTE|PRE|H[1-6])$/.test((c as Element).tagName)
          );
          const lines = inlineOnly
            ? [pad + Array.from(li.childNodes).map(inlineMd).join("").trim()]
            : Array.from(li.children).flatMap((c) => blockMd(c, pad));
          if (!lines.length) return [`${indent}${marker.trimEnd()}`];
          lines[0] = indent + marker + lines[0].slice(pad.length);
          return lines;
        });
    }
    case "BLOCKQUOTE":
      return Array.from(el.children)
        .flatMap((c) => [...blockMd(c), ""])
        .slice(0, -1)
        .map((l) => `${indent}> ${l}`.trimEnd());
    case "PRE":
      return [`${indent}\`\`\``, ...(el.textContent ?? "").replace(/\n$/, "").split("\n").map((l) => indent + l), `${indent}\`\`\``];
    case "IMG":
      return [indent + imageMd(el.getAttribute("src"), el.getAttribute("alt") ?? "")];
    case "TABLE":
      return tableMd(el).map((l) => indent + l);
    default:
      return children();
  }
}

/** A GitHub-style table; the first row is the header (Markdown needs one). */
function tableMd(table: Element): string[] {
  const rows = Array.from(table.querySelectorAll("tr"))
    .filter((tr) => tr.closest("table") === table)
    .map((tr) =>
      Array.from(tr.children)
        .filter((c) => c.tagName === "TD" || c.tagName === "TH")
        .flatMap((c) => {
          const text = Array.from(c.children)
            .flatMap((child) => blockMd(child))
            .join("<br>")
            .replace(/\n/g, " ")
            .replace(/\|/g, "\\|")
            .trim();
          const span = Math.max(1, Number(c.getAttribute("colspan")) || 1);
          return [text || (c.textContent ?? "").trim().replace(/\|/g, "\\|"), ...Array(span - 1).fill("")];
        })
    )
    .filter((r) => r.length);
  if (!rows.length) return [];
  const cols = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? "").join(" | ")} |`;
  return [line(rows[0]), `|${" --- |".repeat(cols)}`, ...rows.slice(1).map(line)];
}

function chartMd(block: ChartBlock): string {
  const data = chartData(block);
  const title = block.title.trim().replace(MD_SPECIAL, "\\$1") || "Chart";
  if (!data.length) return `**${title}** — *chart, no data yet*`;
  const rows = data.map((d) => `| ${d.label.replace(/\|/g, "\\|")} | ${formatNumber(d.value)} |`);
  return [`**${title}** (${block.kind} chart)`, "", "| Label | Value |", "| --- | ---: |", ...rows].join("\n");
}

/** Rich note HTML → Markdown (paragraphs separated by blank lines). */
export function htmlToMarkdown(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const parts: string[] = [];
  for (const el of Array.from(body.children)) {
    const lines = blockMd(el);
    if (lines.length) parts.push(lines.join("\n"));
  }
  return parts.join("\n\n");
}

const CALLOUT_ALERT: Record<CalloutTone, string> = { info: "NOTE", warn: "WARNING", success: "TIP" };

function blockToMarkdown(block: NoteBlock): string {
  switch (block.type) {
    case "text":
      return htmlToMarkdown(blockHtml(block));
    case "callout": {
      const body = htmlToMarkdown(blockHtml(block));
      return [`> [!${CALLOUT_ALERT[block.tone]}]`, ...body.split("\n").map((l) => `> ${l}`.trimEnd())].join("\n");
    }
    case "checklist":
      return block.items
        .filter((i) => i.text.trim())
        .map((i) => `- [${i.done ? "x" : " "}] ${guardLine(i.text.trim()).replace(MD_SPECIAL, "\\$1")}`)
        .join("\n");
    case "link": {
      const href = safeHref(block.url);
      if (!href) return block.label.trim();
      const label = block.label.trim();
      return label ? `[${label.replace(MD_SPECIAL, "\\$1")}](${escapeMdUrl(href)})` : `<${href}>`;
    }
    case "divider":
      return "---";
    case "password":
      return `🔒 **${(block.label || "Password").replace(MD_SPECIAL, "\\$1")}** — encrypted, not included in exports`;
    case "chart":
      return chartMd(block);
  }
}

/** `images` saves pictures next to the Markdown file (see buildProjectArchive). */
export function noteToMarkdown(note: Note, images?: ImageSink): string {
  imageSink = images ?? null;
  try {
    return noteMarkdown(note);
  } finally {
    imageSink = null;
  }
}

function noteMarkdown(note: Note): string {
  const title = note.title.trim() || "Untitled";
  if (note.locked) {
    return `# ${title}\n\n🔒 This note is locked. Its content stays encrypted and isn't included in exports.\n`;
  }
  const body = note.blocks
    .map(blockToMarkdown)
    .filter((s) => s.trim())
    .join("\n\n");
  return `# ${title.replace(/\n/g, " ")}\n\n${body}\n`.replace(/\n{3,}/g, "\n\n");
}

// ───────────────────────── sanitised HTML page ─────────────────────────

function safeHref(href: string | null | undefined): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim());
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}

const KEEP_TAGS = new Set([
  "P", "H1", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE",
  "STRONG", "B", "EM", "I", "U", "S", "DEL", "MARK", "A", "BR", "SPAN",
  "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "IMG",
]);

/** Pictures the exported page can show (it only allows data: images). */
const PAGE_IMAGE = /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/;

/** Rebuild note HTML from an allow-list of tags and attributes. */
export function sanitizeHtml(html: string): string {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    if (DROP_TAGS.has(el.tagName)) return "";
    const inner = Array.from(el.childNodes).map(walk).join("");
    if (!KEEP_TAGS.has(el.tagName)) return inner;
    const tag = el.tagName.toLowerCase();
    if (tag === "br") return "<br>";
    if (tag === "img") {
      const src = el.getAttribute("src") ?? "";
      const alt = escapeHtml(el.getAttribute("alt") ?? "");
      if (PAGE_IMAGE.test(src)) {
        const size = ["width", "height"]
          .filter((a) => /^\d{1,5}$/.test(el.getAttribute(a) ?? ""))
          .map((a) => `${a}="${el.getAttribute(a)}"`)
          .join(" ");
        return `<img src="${src}" alt="${alt}"${size ? " " + size : ""}>`;
      }
      // Web pictures can't load in the page (no network) — link to them.
      const href = safeHref(src);
      return href ? `<p><a href="${escapeHtml(href)}" rel="noopener noreferrer">[Image${alt ? `: ${alt}` : ""}]</a></p>` : "";
    }
    const attrs: string[] = [];
    if (tag === "a") {
      const href = safeHref(el.getAttribute("href"));
      if (!href) return inner;
      attrs.push(`href="${escapeHtml(href)}"`, 'rel="noopener noreferrer"');
    }
    if (tag === "ol" && /^\d+$/.test(el.getAttribute("start") ?? "")) attrs.push(`start="${el.getAttribute("start")}"`);
    const align = (el.getAttribute("style") ?? "").match(/text-align:\s*(center|right|justify)/i)?.[1];
    if (align && /^(p|h1|h2|h3)$/.test(tag)) attrs.push(`style="text-align:${align.toLowerCase()}"`);
    const size = el.getAttribute("data-size");
    if (tag === "span" && size && /^(small|large|huge)$/.test(size)) attrs.push(`data-size="${size}"`);
    const spacing = el.getAttribute("data-spacing");
    if (spacing && /^(compact|relaxed|double)$/.test(spacing)) attrs.push(`data-spacing="${spacing}"`);
    if ((tag === "td" || tag === "th") ) {
      for (const a of ["colspan", "rowspan"]) {
        const v = el.getAttribute(a);
        if (v && /^[1-9]\d?$/.test(v)) attrs.push(`${a}="${v}"`);
      }
    }
    if (tag === "table") return `<div class="table"><table>${inner}</table></div>`;
    if (tag === "span" && !attrs.length) return inner;
    return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>${inner}</${tag}>`;
  };
  return Array.from(body.childNodes).map(walk).join("");
}

function blockToHtml(block: NoteBlock): string {
  switch (block.type) {
    case "text":
      return `<div class="text">${sanitizeHtml(blockHtml(block))}</div>`;
    case "callout":
      return `<aside class="callout ${block.tone}">${sanitizeHtml(blockHtml(block))}</aside>`;
    case "checklist":
      return `<ul class="checklist">${block.items
        .filter((i) => i.text.trim())
        .map((i) => `<li class="${i.done ? "done" : ""}"><span class="box">${i.done ? "✓" : ""}</span>${escapeHtml(i.text)}</li>`)
        .join("")}</ul>`;
    case "link": {
      const href = safeHref(block.url);
      const label = escapeHtml(block.label.trim() || block.url);
      return href
        ? `<p class="linkblock"><a href="${escapeHtml(href)}" rel="noopener noreferrer">${label}</a><span>${escapeHtml(new URL(href).host)}</span></p>`
        : `<p>${label}</p>`;
    }
    case "divider":
      return "<hr>";
    case "password":
      return `<p class="locked">🔒 ${escapeHtml(block.label || "Password")} — encrypted, not included</p>`;
    case "chart": {
      const svg = chartSvg(block);
      const title = escapeHtml(block.title.trim() || "Chart");
      return `<figure class="chart"><figcaption>${title}</figcaption>${svg ?? '<p class="locked">No data yet</p>'}</figure>`;
    }
  }
}

const PAGE_CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;background:#f6f7fb;color:#262626;font:15px/1.65 Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:760px;margin:0 auto;padding:48px 24px 80px}
header.project{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.swatch{width:40px;height:40px;border-radius:12px;flex:none}
header.project h1{margin:0;font-size:28px;line-height:1.2;letter-spacing:-.02em}
header.project p{margin:2px 0 0;color:#737373;font-size:13px}
nav{background:#fff;border:1px solid #e5e5e5;border-radius:16px;padding:14px 18px;margin-bottom:28px}
nav h2{margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#a3a3a3}
nav ol{margin:0;padding-left:20px}nav a{color:#404040;text-decoration:none}nav a:hover{color:#4f46e5}
article{background:#fff;border:1px solid #e5e5e5;border-radius:20px;padding:26px 28px;margin-bottom:20px}
article>h1{margin:0;font-size:22px;letter-spacing:-.01em}
article>.meta{margin:2px 0 18px;color:#a3a3a3;font-size:12px}
.text p{margin:0}.text h1,.text h2,.text h3{color:#171717;margin:.55em 0 .15em;line-height:1.3}
.text h1{font-size:1.45em}.text h2{font-size:1.22em}.text h3{font-size:1.06em}
ul,ol{margin:.15em 0;padding-left:1.4em}li>p{margin:0}
blockquote{margin:.25em 0;border-left:3px solid #e5e5e5;padding-left:.85em;color:#525252}
code{background:#f4f4f5;border-radius:5px;padding:.1em .35em;font:0.86em ui-monospace,Menlo,monospace}
pre{background:#f4f4f5;border-radius:10px;padding:.6em .8em;white-space:pre-wrap}pre code{background:none;padding:0}
mark{background:#fde68a;border-radius:3px;padding:0 .08em}
a{color:#4f46e5;text-decoration-color:#a5b4fc;text-underline-offset:3px}
[data-size=small]{font-size:.86em}[data-size=large]{font-size:1.2em}[data-size=huge]{font-size:1.5em}
[data-spacing=compact]{line-height:1.35}[data-spacing=relaxed]{line-height:1.95}[data-spacing=double]{line-height:2.3}
.block+.block{margin-top:10px}
.callout{border-radius:12px;padding:10px 14px;border:1px solid}
.callout.info{background:#eef2ff;border-color:#e0e7ff}.callout.warn{background:#fffbeb;border-color:#fef3c7}.callout.success{background:#ecfdf5;border-color:#d1fae5}
.callout p{margin:0}
.checklist{list-style:none;padding:0}.checklist li{display:flex;gap:10px;align-items:baseline}
.checklist .box{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:1.5px solid #d4d4d4;border-radius:5px;font-size:11px;color:#fff;transform:translateY(2px)}
.checklist .done .box{background:#6366f1;border-color:#6366f1}.checklist .done{color:#a3a3a3;text-decoration:line-through}
.linkblock{display:flex;gap:10px;align-items:baseline;border:1px solid #e5e5e5;border-radius:12px;padding:10px 14px}
.linkblock span{color:#a3a3a3;font-size:12px}
hr{border:0;border-top:1px solid #e5e5e5;margin:14px 0}
.locked{color:#a3a3a3}
.text img{display:block;max-width:100%;height:auto;border-radius:8px;margin:.4em 0}
.table{overflow-x:auto;margin:.4em 0}
table{border-collapse:collapse;min-width:50%}th,td{border:1px solid #e5e5e5;padding:6px 10px;text-align:left;vertical-align:top}
th{background:#fafafa;font-weight:600}td p,th p{margin:0}
.chart{margin:0;border:1px solid #e5e5e5;border-radius:12px;padding:10px 14px}
.chart figcaption{font-weight:600;font-size:14px;margin-bottom:6px}
footer{color:#a3a3a3;font-size:12px;text-align:center;margin-top:32px}
`;

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function projectHtmlPage(project: NoteProject, notes: Note[], exportedAt = Date.now()): string {
  const title = escapeHtml(project.name);
  const color = /^#[0-9a-f]{6}$/i.test(project.color) ? project.color : "#6366F1";
  const toc = notes
    .map((n, i) => `<li><a href="#note-${i + 1}">${escapeHtml(n.title.trim() || "Untitled")}</a>${n.locked ? " 🔒" : ""}</li>`)
    .join("");
  const articles = notes
    .map((n, i) => {
      const body = n.locked
        ? `<p class="locked">🔒 This note is locked. Its content stays encrypted and isn't included in exports.</p>`
        : n.blocks.map((b) => `<div class="block">${blockToHtml(b)}</div>`).join("");
      return `<article id="note-${i + 1}"><h1>${escapeHtml(n.title.trim() || "Untitled")}</h1><p class="meta">Updated ${escapeHtml(formatDate(n.updatedAt))}</p>${body}</article>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
<meta name="referrer" content="no-referrer">
<title>${title}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
<header class="project"><div class="swatch" style="background:${color}"></div><div><h1>${title}</h1><p>${notes.length} note${notes.length === 1 ? "" : "s"} · exported ${escapeHtml(formatDate(exportedAt))}</p></div></header>
${notes.length ? `<nav><h2>Notes</h2><ol>${toc}</ol></nav>` : "<p>This project has no notes yet.</p>"}
${articles}
<footer>Exported from Browser Workspace Manager</footer>
</main>
</body>
</html>
`;
}

// ───────────────────────── the ZIP ─────────────────────────

export interface ProjectArchive {
  fileName: string;
  folder: string;
  files: Record<string, Uint8Array>;
  dates: Record<string, Date>;
}

/** Files for a project download (notes in the order the project shows them). */
export function buildProjectArchive(project: NoteProject, notes: Note[], exportedAt = Date.now()): ProjectArchive {
  const folder = safeFileName(project.name, "Project");
  const files: Record<string, Uint8Array> = {};
  const dates: Record<string, Date> = {};
  const used = new Set<string>();
  const pad = String(Math.max(notes.length, 1)).length < 2 ? 2 : String(notes.length).length;

  const pageName = uniqueFileName(folder, ".html", used);
  files[`${folder}/${pageName}`] = strToU8(projectHtmlPage(project, notes, exportedAt));
  dates[`${folder}/${pageName}`] = new Date(exportedAt);

  const usedImages = new Set<string>();
  const saved = new Map<string, string>();
  notes.forEach((note, i) => {
    const number = String(i + 1).padStart(pad, "0");
    const base = `${number} ${safeFileName(note.title, "Untitled")}`;
    const name = `${folder}/${uniqueFileName(base, ".md", used)}`;
    let count = 0;
    // Pictures go to images/ beside the Markdown (same picture → same file).
    const sink: ImageSink = (src) => {
      const m = src.match(/^data:image\/(png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/i);
      if (!m) return null;
      const known = saved.get(src);
      if (known) return known;
      count += 1;
      const ext = m[1].toLowerCase() === "jpeg" ? ".jpg" : `.${m[1].toLowerCase()}`;
      const file = uniqueFileName(`${number}-${count}`, ext, usedImages);
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      files[`${folder}/images/${file}`] = bytes;
      dates[`${folder}/images/${file}`] = new Date(note.updatedAt);
      saved.set(src, `images/${encodeURI(file)}`);
      return `images/${encodeURI(file)}`;
    };
    files[name] = strToU8(noteToMarkdown(note, sink));
    dates[name] = new Date(note.updatedAt);
  });

  return { fileName: `${folder}.zip`, folder, files, dates };
}

export function downloadProject(project: NoteProject, notes: Note[]): void {
  const archive = buildProjectArchive(project, notes);
  const bytes = zipStore(archive.files, archive.dates);
  const blob = new Blob([bytes as BlobPart], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = archive.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
