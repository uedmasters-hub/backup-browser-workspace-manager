/**
 * Note download harness (parts that don't need a browser DOM): RTF and XML
 * escaping, list markers, page size, and the .docx / .rtf built from
 * checklist, link, divider and password blocks. Rich Text/Callout HTML goes
 * through DOMParser and is checked in the browser test.
 * Run: npx tsx scripts/noteDownloadHarness.ts
 */
import { buildDocModel, orderedMarker, pageSetupFor } from "../src/components/popup/notes/docModel";
import { docxFiles, docToDocx, xmlEscape } from "../src/components/popup/notes/docDocx";
import { docToRtf, rtfEscape } from "../src/components/popup/notes/docRtf";
import { strFromU8 } from "../src/browser/backup/zip";
import type { Note } from "../src/types/notes";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      ${detail}`); }
}
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, JSON.stringify(got) === JSON.stringify(want), `got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);

// ── escaping ──
eq("rtf: braces and backslash escaped", rtfEscape("a{b}\\c"), "a\\{b\\}\\\\c");
eq("rtf: non-ASCII as \\uN?", rtfEscape("é—"), "\\u233?\\u8212?");
eq("rtf: emoji as a signed surrogate pair", rtfEscape("🚀"), "\\u-10179?\\u-8576?");
eq("rtf: tab and newline", rtfEscape("a\tb\nc"), "a\\tab b\\line c");
eq("rtf: control characters dropped", rtfEscape("a\u0001b"), "ab");
eq("xml: specials escaped", xmlEscape(`<a href="x">&</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;");
eq("xml: invalid characters dropped", xmlEscape("a\u0000b\u000bc￿d"), "abcd");
eq("xml: lone surrogate dropped, pairs kept", xmlEscape("x\ud83dy🚀"), "xy🚀");

// ── markers & page ──
eq("ordered markers by depth", [orderedMarker(3, 0), orderedMarker(2, 1), orderedMarker(28, 1), orderedMarker(4, 2), orderedMarker(9, 5)], ["3.", "b.", "ab.", "iv.", "ix."]);
eq("A4 by default", pageSetupFor("en-IN").width, 11906);
eq("Letter in the US", pageSetupFor("en-US").width, 12240);
eq("unknown locale → A4", pageSetupFor(undefined).height, 16838);

// ── document model (non-HTML blocks) ──
const note = (blocks: Note["blocks"], extra: Partial<Note> = {}): Note => ({
  id: "n", title: "Launch {plan}", blocks, createdAt: 1, updatedAt: Date.UTC(2026, 9, 1), ...extra,
});
const sample = note([
  { id: "1", type: "checklist", items: [{ id: "a", text: "Design", done: true }, { id: "b", text: "Ship", done: false }, { id: "c", text: " ", done: false }] },
  { id: "2", type: "link", label: "Spec", url: "https://docs.example.com/spec?a=1&b=2" },
  { id: "3", type: "link", label: "Bad", url: "javascript:alert(1)" },
  { id: "4", type: "divider" },
  { id: "5", type: "password", label: "Staging DB", cipher: "SECRET-CIPHER" } as Note["blocks"][number],
]);
const model = buildDocModel(sample);
eq("model: title, meta, then blocks", model.paragraphs.map((p) => p.kind), ["title", "meta", "body", "body", "body", "body", "divider", "body"]);
eq("model: empty checklist items skipped", model.paragraphs.filter((p) => p.check).map((p) => [p.runs[0].text, p.check!.done]), [["Design", true], ["Ship", false]]);
check("model: unsafe link becomes plain text", model.paragraphs.some((p) => p.runs[0]?.text === "Bad" && !p.runs[0].href));
check("model: room above each block but the first", !model.paragraphs[2].blockStart && !model.paragraphs[3].blockStart && Boolean(model.paragraphs[4].blockStart));
eq("model: untitled note", buildDocModel(note([], { title: "  " })).title, "Untitled");

// ── .docx ──
const files = docxFiles(model, pageSetupFor("en-US"), Date.UTC(2026, 9, 2));
eq("docx: package parts", Object.keys(files), [
  "[Content_Types].xml", "_rels/.rels", "docProps/core.xml", "docProps/app.xml",
  "word/document.xml", "word/styles.xml", "word/numbering.xml", "word/_rels/document.xml.rels",
]);
const xml = strFromU8(files["word/document.xml"]);
const rels = strFromU8(files["word/_rels/document.xml.rels"]);
check("docx: title uses the Title style", xml.includes('<w:pStyle w:val="Title"/>') && xml.includes("Launch {plan}"));
check("docx: link is a real hyperlink with an escaped target",
  xml.includes('<w:hyperlink r:id="rIdLink1"') && rels.includes('Target="https://docs.example.com/spec?a=1&amp;b=2" TargetMode="External"'));
check("docx: no javascript: target anywhere", !xml.includes("javascript") && !rels.includes("javascript"));
check("docx: divider is a bottom border", xml.includes("<w:pBdr><w:bottom "));
check("docx: password secret never written", !xml.includes("SECRET") && xml.includes("Staging DB"));
check("docx: Letter page size", xml.includes('<w:pgSz w:w="12240" w:h="15840"/>'));
check("docx: core title", strFromU8(files["docProps/core.xml"]).includes("<dc:title>Launch {plan}</dc:title>"));
const zip = docToDocx(model, pageSetupFor("en-US"));
eq("docx: zip signature", [...zip.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04]);

// ── .rtf ──
const rtf = docToRtf(model, pageSetupFor("en-IN"), Date.UTC(2026, 9, 2));
check("rtf: header and closing brace", rtf.startsWith("{\\rtf1\\ansi") && rtf.trimEnd().endsWith("}"));
check("rtf: braces balanced", [...rtf.replace(/\\[\\{}]/g, "")].reduce((n, c) => n + (c === "{" ? 1 : c === "}" ? -1 : 0), 0) === 0);
check("rtf: title escaped", rtf.includes("Launch \\{plan\\}"));
check("rtf: hyperlink field", rtf.includes('{\\field{\\*\\fldinst{HYPERLINK "https://docs.example.com/spec?a=1&b=2"}}'));
check("rtf: checklist boxes", rtf.includes("\\u9745?") && rtf.includes("\\u9744?"));
check("rtf: password secret never written", !rtf.includes("SECRET"));
check("rtf: A4 page", rtf.includes("\\paperw11906\\paperh16838"));

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
