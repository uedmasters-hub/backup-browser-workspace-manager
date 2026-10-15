/**
 * Rich-text notes harness: legacy conversion, plain-text paste structure,
 * plain-text mirror, and merging neighbouring text blocks.
 * Run: npx tsx scripts/richTextHarness.ts
 */
import {
  legacyTextToHtml,
  pastedTextToHtml,
  docToPlainText,
  mergeTextBlocks,
  blockHtml,
} from "../src/components/popup/notes/richText";
import type { NoteBlock } from "../src/types/notes";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      ${detail}`); }
}
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, JSON.stringify(got) === JSON.stringify(want), `got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);

// ---- legacy notes keep their shape
eq("legacy: one paragraph per line, blanks kept",
  legacyTextToHtml("a\n\nb"), "<p>a</p><p></p><p>b</p>");
eq("legacy: URLs become links",
  legacyTextToHtml("1. http://jiro.build - prompts"),
  '<p>1. <a href="http://jiro.build/">http://jiro.build</a> - prompts</p>');
eq("legacy: numbered lines are NOT turned into lists", legacyTextToHtml("1. one\n2. two").includes("<ol"), false);
eq("legacy: HTML is escaped", legacyTextToHtml('<img src=x onerror="x">'), "<p>&lt;img src=x onerror=&quot;x&quot;&gt;</p>");
eq("legacy: empty stays empty", legacyTextToHtml(""), "");

// ---- pasting plain text
eq("paste: bullets → list",
  pastedTextToHtml("- one\n* two\n• three"),
  "<ul><li><p>one</p></li><li><p>two</p></li><li><p>three</p></li></ul>");
eq("paste: numbers → ordered list, keeps start",
  pastedTextToHtml("3. c\n4. d"),
  '<ol start="3"><li><p>c</p></li><li><p>d</p></li></ol>');
eq("paste: blank lines dropped",
  pastedTextToHtml("a\n\n\n\nb"), "<p>a</p><p>b</p>");
eq("paste: loose list stays one list",
  pastedTextToHtml("- a\n\n- b"), "<ul><li><p>a</p></li><li><p>b</p></li></ul>");
eq("paste: text after a list ends it",
  pastedTextToHtml("- a\nafter"), "<ul><li><p>a</p></li></ul><p>after</p>");
eq("paste: # headings", pastedTextToHtml("# Title\n## Sub\n### Small"), "<h1>Title</h1><h2>Sub</h2><h3>Small</h3>");
eq("paste: > quote", pastedTextToHtml("> said"), "<blockquote><p>said</p></blockquote>");
eq("paste: **bold**, *italic*, `code`",
  pastedTextToHtml("**Bold** and *it* and `x`"),
  "<p><strong>Bold</strong> and <em>it</em> and <code>x</code></p>");
eq("paste: asterisks in maths aren't italics", pastedTextToHtml("2 * 3 * 4"), "<p>2 * 3 * 4</p>");
eq("paste: URL underscores untouched",
  pastedTextToHtml("see https://a.com/x_y_z"),
  '<p>see <a href="https://a.com/x_y_z">https://a.com/x_y_z</a></p>');
eq("paste: nbsp and trailing spaces cleaned", pastedTextToHtml("a\u00a0b   "), "<p>a b</p>");
eq("paste: CRLF handled", pastedTextToHtml("a\r\nb"), "<p>a</p><p>b</p>");
eq("paste: years aren't list items", pastedTextToHtml("2024 was good").includes("<ol"), false);

// ---- plain-text mirror
const doc = {
  type: "doc",
  content: [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Plan" }] },
    { type: "paragraph", content: [{ type: "text", text: "Line one" }, { type: "hardBreak" }, { type: "text", text: "line two" }] },
    { type: "bulletList", content: [
      { type: "listItem", content: [
        { type: "paragraph", content: [{ type: "text", text: "Apples" }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Green" }] }] }] },
      ] },
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Pears" }] }] },
    ] },
    { type: "orderedList", attrs: { start: 3 }, content: [
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Third" }] }] },
      { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Fourth" }] }] },
    ] },
    { type: "blockquote", content: [{ type: "paragraph", content: [{ type: "text", text: "Quote" }] }] },
    { type: "paragraph" },
  ],
};
eq("mirror: headings, breaks, nested bullets, numbers, quotes",
  docToPlainText(doc).split("\n"),
  ["Plan", "Line one", "line two", "• Apples", "  • Green", "• Pears", "3. Third", "4. Fourth", "> Quote"]);
eq("mirror: empty doc → empty string", docToPlainText({ type: "doc", content: [{ type: "paragraph" }] }), "");
eq("mirror: empty paragraphs in the middle kept as blank lines",
  docToPlainText({ type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "a" }] }, { type: "paragraph" },
    { type: "paragraph", content: [{ type: "text", text: "b" }] }] }),
  "a\n\nb");

// ---- merging neighbouring text blocks
const t = (id: string, text: string, html?: string): NoteBlock => ({ id, type: "text", text, ...(html ? { html } : {}) });
const div: NoteBlock = { id: "d", type: "divider" };
const m1 = mergeTextBlocks([t("a", "one"), t("b", "two", "<p><strong>two</strong></p>"), div, t("c", "three")]);
eq("merge: neighbours join, others untouched", m1.map((b) => b.id), ["a", "d", "c"]);
eq("merge: html combined (legacy converted)", blockHtml(m1[0] as { text: string; html?: string }), "<p>one</p><p><strong>two</strong></p>");
eq("merge: text mirror combined", (m1[0] as { text: string }).text, "one\ntwo");
const m2 = mergeTextBlocks([t("a", ""), t("b", "kept")]);
eq("merge: empty first takes the next one's content, keeps first id", [m2.length, m2[0].id, (m2[0] as { text: string }).text], [1, "a", "kept"]);
eq("merge: empty followers vanish", mergeTextBlocks([t("a", "x"), t("b", ""), t("c", "")]).length, 1);
const same = [t("a", "x"), div, t("c", "y")];
check("merge: nothing to do → same array (no needless save)", mergeTextBlocks(same) === same);

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
