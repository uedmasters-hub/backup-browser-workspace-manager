/**
 * Cleans HTML pasted from other apps (Google Docs, Word, web pages, chat
 * apps, other notes) before the editor reads it.
 *
 * Kept: structure (paragraphs, headings, lists, quotes, code, tables), bold,
 * italic, underline, strikethrough, links, text alignment, images, and our
 * own size/spacing. Charts drawn as SVG come in as images; video, audio and
 * embeds become a link to their source.
 * Dropped: fonts, colours, font sizes, line heights, margins, classes, ids,
 * scripts/forms, tracking pixels and icons, empty paragraphs, doubled line
 * breaks, non-breaking spaces.
 *
 * Runs on an inert document from DOMParser — nothing in it is executed or
 * loaded, and the result is only ever parsed by the editor's schema.
 */

import { isNoteImageSrc } from "./images";

/** Inline styles worth keeping — they carry formatting the editor understands. */
const KEEP_STYLES = new Set([
  "text-align",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);

const DROP_ELEMENTS =
  "style,script,meta,link,title,noscript,template,canvas,form,input,button,select,textarea,head,colgroup,col";

const BLOCKS = "p,div,h1,h2,h3,h4,h5,h6,li,blockquote,pre";

function unwrap(el: Element) {
  el.replaceWith(...Array.from(el.childNodes));
}

function cleanStyle(el: HTMLElement) {
  const kept: string[] = [];
  for (const decl of (el.getAttribute("style") ?? "").split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const prop = decl.slice(0, i).trim().toLowerCase();
    const value = decl.slice(i + 1).trim().toLowerCase();
    if (!KEEP_STYLES.has(prop)) continue;
    // "left"/"start" is the default — it only clutters the note.
    if (prop === "text-align" && !["center", "right", "justify"].includes(value)) continue;
    if (prop === "font-weight" && !(value === "bold" || value === "bolder" || Number(value) >= 600)) continue;
    if (prop === "font-style" && value !== "italic") continue;
    if (prop.startsWith("text-decoration") && !/underline|line-through/.test(value)) continue;
    kept.push(`${prop}: ${value}`);
  }
  if (kept.length) el.setAttribute("style", kept.join("; "));
  else el.removeAttribute("style");
}

/** Word marks list items as styled paragraphs; turn runs of them into real lists. */
function convertWordLists(body: HTMLElement) {
  const doc = body.ownerDocument;
  const items = Array.from(body.querySelectorAll<HTMLElement>("p")).filter((p) =>
    /mso-list:\s*l\d/i.test(p.getAttribute("style") ?? "")
  );
  for (const p of items) {
    const marker = Array.from(p.querySelectorAll<HTMLElement>("span")).find((s) =>
      /mso-list:\s*ignore/i.test(s.getAttribute("style") ?? "")
    );
    const markerText = marker?.textContent?.replace(/\s+/g, "") ?? "";
    marker?.remove();
    const tag = /^[\da-z]{1,3}[.)]$/i.test(markerText) ? "OL" : "UL";

    // Continue the list right before this paragraph, or start a new one.
    const prev = p.previousElementSibling;
    let list: Element;
    if (prev && prev.tagName === tag && prev.hasAttribute("data-word-list")) {
      list = prev;
    } else {
      list = doc.createElement(tag);
      list.setAttribute("data-word-list", "");
      p.before(list);
    }
    const li = doc.createElement("li");
    li.append(...Array.from(p.childNodes));
    list.append(li);
    p.remove();
  }
}

const px = (v: string | null) => {
  const n = Number.parseFloat(v ?? "");
  return Number.isFinite(n) && n > 0 ? n : 0;
};

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

/** UTF-8 safe base64 for an SVG document. */
function svgDataUrl(markup: string): string {
  const bytes = new TextEncoder().encode(markup);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

/**
 * Pictures and media, before anything else is cleaned:
 * - <picture> → its <img>; images keep only src / alt / size, and only
 *   sources a note can hold (see isNoteImageSrc). 1–2px trackers go.
 * - Inline SVG big enough to be a chart or diagram → an image (rasterised to
 *   PNG once it's in the note); small ones are icons and go.
 * - Video / audio / iframes / embeds → a link to what they showed.
 */
function convertMedia(body: HTMLElement) {
  const doc = body.ownerDocument;
  body.querySelectorAll("picture").forEach((p) => {
    const img = p.querySelector("img");
    if (img) p.replaceWith(img);
    else p.remove();
  });

  for (const svg of Array.from(body.querySelectorAll("svg"))) {
    if (svg.parentElement?.closest("svg")) continue;
    const box = svg.getAttribute("viewBox")?.split(/[\s,]+/).map(Number) ?? [];
    const w = px(svg.getAttribute("width")) || box[2] || 0;
    const h = px(svg.getAttribute("height")) || box[3] || 0;
    if (w < 48 || h < 48) {
      svg.remove();
      continue;
    }
    const copy = svg.cloneNode(true) as SVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", String(Math.round(w)));
    copy.setAttribute("height", String(Math.round(h)));
    copy.querySelectorAll("script,foreignObject").forEach((el) => el.remove());
    const img = doc.createElement("img");
    img.setAttribute("src", svgDataUrl(new XMLSerializer().serializeToString(copy)));
    img.setAttribute("width", String(Math.round(w)));
    img.setAttribute("height", String(Math.round(h)));
    const label = svg.getAttribute("aria-label") ?? svg.querySelector("title")?.textContent;
    if (label) img.setAttribute("alt", label.trim().slice(0, 120));
    svg.replaceWith(img);
  }

  for (const img of Array.from(body.querySelectorAll("img"))) {
    const src = img.getAttribute("src");
    const w = px(img.getAttribute("width"));
    const h = px(img.getAttribute("height"));
    if (!isNoteImageSrc(src) || (w && w <= 2) || (h && h <= 2)) {
      // Local files (Word/Excel) arrive separately as a picture on the
      // clipboard — the editor adds those; anything else can't be shown.
      img.remove();
      continue;
    }
    for (const { name } of Array.from(img.attributes)) {
      if (!["src", "alt", "width", "height"].includes(name)) img.removeAttribute(name);
    }
    if (img.hasAttribute("width") && !w) img.removeAttribute("width");
    if (img.hasAttribute("height") && !h) img.removeAttribute("height");
  }

  const KINDS: Record<string, string> = { VIDEO: "Video", AUDIO: "Audio", IFRAME: "Embedded page", EMBED: "Embedded content", OBJECT: "Embedded content" };
  for (const el of Array.from(body.querySelectorAll("video,audio,iframe,embed,object"))) {
    if (!el.isConnected) continue;
    const src = httpUrl(
      el.getAttribute("src") ?? el.getAttribute("data") ?? el.querySelector("source[src]")?.getAttribute("src")
    );
    if (!src) {
      el.remove();
      continue;
    }
    const p = doc.createElement("p");
    const a = doc.createElement("a");
    a.setAttribute("href", src);
    a.textContent = `${KINDS[el.tagName] ?? "Media"}: ${new URL(src).host}`;
    p.append(a);
    el.replaceWith(p);
  }
}

export function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  body.querySelectorAll("script,style,template,noscript").forEach((el) => el.remove());
  convertMedia(body);
  body.querySelectorAll(DROP_ELEMENTS).forEach((el) => el.remove());
  // A table caption reads as the line above the table.
  body.querySelectorAll("caption").forEach((c) => {
    const table = c.closest("table");
    const p = doc.createElement("p");
    p.append(...Array.from(c.childNodes));
    c.remove();
    if (table && p.textContent?.trim()) table.before(p);
  });

  // Comments (Word/Office conditional comments carry styles).
  const walker = doc.createTreeWalker(body, NodeFilter.SHOW_COMMENT);
  const comments: Node[] = [];
  while (walker.nextNode()) comments.push(walker.currentNode);
  comments.forEach((c) => c.parentNode?.removeChild(c));

  // Google Docs wraps everything in <b style="font-weight:normal" id="docs-internal-guid-…">.
  body.querySelectorAll('b[id^="docs-internal-guid"]').forEach(unwrap);
  // Word's empty-paragraph markers and font tags.
  body.querySelectorAll("o\\:p, font").forEach(unwrap);

  convertWordLists(body);

  // Headings deeper than H3 read as H3.
  body.querySelectorAll("h4,h5,h6").forEach((h) => {
    const h3 = doc.createElement("h3");
    h3.append(...Array.from(h.childNodes));
    h.replaceWith(h3);
  });

  for (const el of Array.from(body.querySelectorAll<HTMLElement>("*"))) {
    for (const { name } of Array.from(el.attributes)) {
      const keep =
        name === "style" ||
        name === "data-size" ||
        name === "data-spacing" ||
        (el.tagName === "A" && name === "href") ||
        (el.tagName === "OL" && name === "start") ||
        (el.tagName === "IMG" && ["src", "alt", "width", "height"].includes(name)) ||
        ((el.tagName === "TD" || el.tagName === "TH") &&
          (name === "colspan" || name === "rowspan") &&
          /^[1-9]\d?$/.test(el.getAttribute(name) ?? ""));
      if (!keep) el.removeAttribute(name);
    }
    if (el.hasAttribute("style")) cleanStyle(el);
  }

  // Non-breaking spaces (Docs/Word use them for spacing) → normal spaces.
  const textWalker = doc.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  while (textWalker.nextNode()) {
    const node = textWalker.currentNode as Text;
    if (node.data.includes("\u00a0")) node.data = node.data.replace(/\u00a0/g, " ");
  }

  // Doubled line breaks → one; breaks at the edges of a block → none.
  for (const br of Array.from(body.querySelectorAll("br"))) {
    let next = br.nextSibling;
    while (next && next.nodeType === Node.TEXT_NODE && !next.textContent?.trim()) next = next.nextSibling;
    if (next && next.nodeName === "BR") br.remove();
  }
  for (const block of Array.from(body.querySelectorAll(BLOCKS))) {
    while (block.firstChild?.nodeName === "BR") block.firstChild.remove();
    while (block.lastChild?.nodeName === "BR") block.lastChild.remove();
  }

  // Empty paragraphs/blocks — the editor already spaces paragraphs.
  for (const block of Array.from(body.querySelectorAll(BLOCKS)).reverse()) {
    if (block.querySelector("img,table")) continue; // a picture or table is content
    if (!block.textContent?.replace(/[\s\u200b]/g, "")) block.remove();
  }
  // Top-level stray <br>s between blocks.
  body.querySelectorAll(":scope > br").forEach((br) => br.remove());

  return body.innerHTML;
}
