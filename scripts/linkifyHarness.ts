/**
 * Linkify harness: URL detection used to render clickable links in notes.
 * Run: npx tsx scripts/linkifyHarness.ts
 */
import { linkify, hasLinks } from "../src/components/popup/notes/linkify";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label} ${detail}`);
  }
}
const links = (t: string) =>
  linkify(t).filter((s) => s.kind === "link").map((s) => s.text);

const note = "1. 👑 http://scrolltide.co\nWhy it's different:\n2. http://designmd.ai - design systems";
check("finds both URLs in the sample note", JSON.stringify(links(note)) === JSON.stringify(["http://scrolltide.co", "http://designmd.ai"]), JSON.stringify(links(note)));
check("segments rebuild the original text", linkify(note).map((s) => s.text).join("") === note);
check("segment start offsets are exact", linkify(note).every((s) => note.slice(s.start, s.start + s.text.length) === s.text));
check("trailing period is not part of the URL", JSON.stringify(links("See https://a.com/x.")) === '["https://a.com/x"]');
check("wrapping parens are dropped", JSON.stringify(links("(see https://a.com/x)")) === '["https://a.com/x"]');
check("balanced parens are kept", JSON.stringify(links("https://en.wikipedia.org/wiki/Foo_(bar)")) === '["https://en.wikipedia.org/wiki/Foo_(bar)"]');
check("query strings and hashes kept", JSON.stringify(links("go https://x.io/a?b=1&c=2#top now")) === '["https://x.io/a?b=1&c=2#top"]');
const www = linkify("visit www.example.com today").find((s) => s.kind === "link");
check("www. links get an https href", www?.kind === "link" && www.href === "https://www.example.com/");
check("bare domains stay plain text", !hasLinks("file.ts and e.g. example.com"));
check("javascript: is never a link", !hasLinks("javascript:alert(1)"));
check("scheme with no host is ignored", !hasLinks("http:// nothing"));
check("plain text has no links", !hasLinks("just a note"));
check("empty string is safe", linkify("").length === 0);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
