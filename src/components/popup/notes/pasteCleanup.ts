/**
 * Cleans HTML pasted from other apps (Google Docs, Word, web pages, chat
 * apps, other notes) before the editor reads it.
 *
 * Kept: structure (paragraphs, headings, lists, quotes, code), bold, italic,
 * underline, strikethrough, links, text alignment, and our own size/spacing.
 * Dropped: fonts, colours, font sizes, line heights, margins, classes, ids,
 * images/media, empty paragraphs, doubled line breaks, non-breaking spaces.
 *
 * Runs on an inert document from DOMParser — nothing in it is executed or
 * loaded, and the result is only ever parsed by the editor's schema.
 */

/** Inline styles worth keeping — they carry formatting the editor understands. */
const KEEP_STYLES = new Set([
  "text-align",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-decoration-line",
]);

const DROP_ELEMENTS =
  "style,script,meta,link,title,noscript,template,iframe,object,embed,svg,canvas,video,audio,img,picture,source,form,input,button,select,textarea,head";

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

export function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  body.querySelectorAll(DROP_ELEMENTS).forEach((el) => el.remove());

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
        (el.tagName === "OL" && name === "start");
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
    if (!block.textContent?.replace(/[\s\u200b]/g, "")) block.remove();
  }
  // Top-level stray <br>s between blocks.
  body.querySelectorAll(":scope > br").forEach((br) => br.remove());

  return body.innerHTML;
}
