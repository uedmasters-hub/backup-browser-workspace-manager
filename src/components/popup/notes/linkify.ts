/**
 * Splits plain note text into text and link segments so URLs can be
 * rendered as real, clickable links while the source stays plain text.
 *
 * Detects `http://…`, `https://…` and `www.…`. Bare domains ("example.com")
 * are left alone on purpose — they collide with file names and abbreviations.
 */

export type TextSegment =
  | { kind: "text"; text: string; start: number }
  | { kind: "link"; text: string; href: string; start: number };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;

/** Characters that usually end a sentence rather than a URL. */
const TRAILING_PUNCTUATION = /[.,;:!?'"*]$/;

const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function count(text: string, char: string): number {
  let n = 0;
  for (const c of text) if (c === char) n++;
  return n;
}

/** Drop trailing punctuation and unbalanced closing brackets: "(see https://a.com/x)." → "https://a.com/x". */
function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const last = url.slice(-1);
    if (TRAILING_PUNCTUATION.test(last)) {
      url = url.slice(0, -1);
      continue;
    }
    const opener = CLOSERS[last];
    if (opener && count(url, last) > count(url, opener)) {
      url = url.slice(0, -1);
      continue;
    }
    return url;
  }
}

/** Returns a safe http(s) href for a matched URL, or null if it isn't one. */
export function toHref(match: string): string | null {
  const candidate = /^www\./i.test(match) ? `https://${match}` : match;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function linkify(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    const url = trimUrl(match[0]);
    const href = url ? toHref(url) : null;
    if (!href) continue;

    if (start > cursor) {
      segments.push({ kind: "text", text: text.slice(cursor, start), start: cursor });
    }
    segments.push({ kind: "link", text: url, href, start });
    cursor = start + url.length;
  }

  if (cursor < text.length) {
    segments.push({ kind: "text", text: text.slice(cursor), start: cursor });
  }
  return segments;
}

export function hasLinks(text: string): boolean {
  return linkify(text).some((s) => s.kind === "link");
}
