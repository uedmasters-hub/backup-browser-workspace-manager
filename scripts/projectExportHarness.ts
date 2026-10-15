/**
 * Project export harness (parts that don't need a browser DOM): file names,
 * Markdown for non-text blocks, locked notes, archive layout.
 * HTML→Markdown and the HTML page are checked in the browser test.
 * Run: npx tsx scripts/projectExportHarness.ts
 */
import { safeFileName, uniqueFileName, noteToMarkdown } from "../src/components/popup/notes/projectExport";
import type { Note } from "../src/types/notes";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      ${detail}`); }
}
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, JSON.stringify(got) === JSON.stringify(want), `got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);

eq("unsafe characters removed", safeFileName('Q3: plan / "draft" <v2>?', "x"), "Q3 plan draft v2");
eq("control characters removed", safeFileName("a\u0000b\tc\u007fd", "x"), "a b c d");
eq("leading dots / trailing dots+spaces removed", safeFileName("..hidden name. . ", "x"), "hidden name");
eq("Windows reserved names fall back", safeFileName("CON", "Untitled"), "Untitled");
eq("empty falls back", safeFileName("   ", "Untitled"), "Untitled");
eq("long names capped at 80", safeFileName("x".repeat(200), "u").length, 80);
eq("non-English names kept", safeFileName("ई-मेडिकल्स 日本 café", "x"), "ई-मेडिकल्स 日本 café");

const used = new Set<string>();
eq("unique: first as-is", uniqueFileName("Plan", ".md", used), "Plan.md");
eq("unique: duplicates numbered", uniqueFileName("Plan", ".md", used), "Plan (2).md");
eq("unique: case-insensitive", uniqueFileName("PLAN", ".md", used), "PLAN (3).md");

const note = (blocks: Note["blocks"], extra: Partial<Note> = {}): Note => ({
  id: "n", title: "Launch checklist", blocks, createdAt: 1, updatedAt: 1, ...extra,
});
eq("markdown: checklist, link, divider, password",
  noteToMarkdown(note([
    { id: "1", type: "checklist", items: [{ id: "a", text: "Design *final*", done: true }, { id: "b", text: "Ship", done: false }, { id: "c", text: " ", done: false }] },
    { id: "2", type: "link", label: "Spec", url: "https://docs.example.com/spec (v2)" },
    { id: "3", type: "link", label: "", url: "https://example.com" },
    { id: "4", type: "link", label: "Bad", url: "javascript:alert(1)" },
    { id: "5", type: "divider" },
    { id: "6", type: "password", label: "Staging DB" },
  ])).split("\n"),
  ["# Launch checklist", "", "- [x] Design \\*final\\*", "- [ ] Ship", "", "[Spec](https://docs.example.com/spec%20%28v2%29)", "",
   "<https://example.com/>", "", "Bad", "", "---", "", "🔒 **Staging DB** — encrypted, not included in exports", ""]);
const locked = noteToMarkdown(note([{ id: "1", type: "text", text: "secret" }], { locked: true }));
check("locked note: content never exported", !locked.includes("secret") && locked.includes("locked"));
eq("untitled note gets a title", noteToMarkdown(note([], { title: "  " })).split("\n")[0], "# Untitled");

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
