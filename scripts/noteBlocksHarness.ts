/**
 * Note blocks harness (parts that don't need a browser DOM): chart numbers,
 * pasted chart rows and the chart SVG; tab-separated text → table; the
 * plain-text mirror of pictures and tables; table grids with merged cells;
 * pictures, tables and charts in the .docx / .rtf / Markdown exports.
 * Editing, pasting HTML and pictures are checked in the browser test.
 * Run: npx tsx scripts/noteBlocksHarness.ts
 */
import { chartData, chartSvg, parseChartRows, parseNumber } from "../src/components/popup/notes/chart";
import { docToPlainText, tabularTextToHtml } from "../src/components/popup/notes/richText";
import { buildDocModel, embeddableImage, pageSetupFor, tableGrid } from "../src/components/popup/notes/docModel";
import type { DocCell } from "../src/components/popup/notes/docModel";
import { docxFiles } from "../src/components/popup/notes/docDocx";
import { docToRtf } from "../src/components/popup/notes/docRtf";
import { noteToMarkdown } from "../src/components/popup/notes/projectExport";
import { isBlockEmpty } from "../src/components/popup/notes/blockTypes";
import { strFromU8 } from "../src/browser/backup/zip";
import type { ChartBlock, Note } from "../src/types/notes";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ ${label}\n      ${detail}`); }
}
const eq = (label: string, got: unknown, want: unknown) =>
  check(label, JSON.stringify(got) === JSON.stringify(want), `got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`);

// ── numbers & pasted rows ──
eq("numbers: plain, grouped, currency, percent",
  ["12", "1,234", "€ 1.234,5", "₹2,50,000", "45%"].map(parseNumber), [12, 1234, 1234.5, 250000, 45]);
eq("numbers: negative and accounting", [parseNumber("-3.5"), parseNumber("(30)"), parseNumber("−2")], [-3.5, -30, -2]);
eq("numbers: decimal comma, not a number", [parseNumber("0,75"), parseNumber("abc"), parseNumber("")], [0.75, null, null]);
eq("rows: spreadsheet paste with header",
  parseChartRows("Month\tSales\nJan\t1,200\nFeb\t950\n"),
  [{ label: "Jan", value: 1200 }, { label: "Feb", value: 950 }]);
eq("rows: typed lines", parseChartRows("Tea: 40\nCoffee, 75\nWater 10"),
  [{ label: "Tea", value: 40 }, { label: "Coffee", value: 75 }, { label: "Water", value: 10 }]);
eq("rows: lone numbers have no label", parseChartRows("5\n7"), [{ label: "", value: 5 }, { label: "", value: 7 }]);

// ── chart SVG ──
const chart = (extra: Partial<ChartBlock> = {}): ChartBlock => ({
  id: "c", type: "chart", kind: "bar", title: "Sales <2026>",
  points: [
    { id: "1", label: "Jan", value: 1200 },
    { id: "2", label: "<b>Feb</b>", value: 950 },
    { id: "3", label: "", value: null },
  ],
  ...extra,
});
const svg = chartSvg(chart()) ?? "";
check("svg: bars drawn for filled values only", (svg.match(/<rect /g) ?? []).length === 2, svg.slice(0, 200));
check("svg: labels and title escaped", svg.includes("&lt;b&gt;Feb&lt;/b&gt;") && svg.includes('aria-label="Sales &lt;2026&gt;"') && !svg.includes("<b>"));
check("svg: line chart has a line", (chartSvg(chart({ kind: "line" })) ?? "").includes("<polyline"));
check("svg: pie chart has slices and a legend", (() => {
  const pie = chartSvg(chart({ kind: "pie" })) ?? "";
  return (pie.match(/<path /g) ?? []).length === 2 && pie.includes("56%");
})());
eq("svg: nothing to draw → null", chartSvg(chart({ points: [{ id: "x", label: "a", value: null }] })), null);
eq("chart data: default labels", chartData({ points: [{ id: "x", label: " ", value: 3 }] }), [{ label: "#1", value: 3 }]);
check("empty chart counts as empty", isBlockEmpty(chart({ title: "", points: [{ id: "x", label: "", value: null }] })) && !isBlockEmpty(chart()));

// ── tab-separated paste → table ──
const t = tabularTextToHtml("Item\tPrice\nTea\t40\nCoffee\t75") ?? "";
check("tsv: becomes a table with a header row", t.startsWith("<table>") && t.includes("<th><p>Item</p></th>") && t.includes("<td><p>75</p></td>"));
eq("tsv: ordinary text isn't a table", tabularTextToHtml("one line\nanother line"), null);
check("tsv: cells are escaped", (tabularTextToHtml("a\t<b>\nc\td") ?? "").includes("&lt;b&gt;"));

// ── plain-text mirror ──
eq("text mirror: pictures and tables",
  docToPlainText({ type: "doc", content: [
    { type: "paragraph", content: [{ type: "text", text: "Intro" }] },
    { type: "image", attrs: { alt: "Diagram" } },
    { type: "table", content: [
      { type: "tableRow", content: [
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }] },
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }] }] },
      { type: "tableRow", content: [
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "1" }] }] },
        { type: "tableCell", content: [{ type: "paragraph" }] }] },
    ] },
  ] }),
  "Intro\n[Image: Diagram]\nA | B\n1 | ");

// ── table grid with merged cells ──
const cell = (text: string, colspan = 1, rowspan = 1): DocCell => ({ header: false, colspan, rowspan, paragraphs: [{ kind: "body", runs: [{ text }] }] });
const grid = tableGrid({ rows: [
  { cells: [cell("a"), cell("b"), cell("c")] },
  { cells: [cell("wide", 2, 2), cell("x")] },
  { cells: [cell("y")] },
  { cells: [cell("short")] },
] });
eq("grid: columns", grid.cols, 3);
eq("grid: row span continues below, short rows padded",
  grid.rows.map((r) => r.map((s) => (s.cell ? s.cell.paragraphs[0].runs[0].text : s.vmerge ?? "pad") + (s.span > 1 ? `×${s.span}` : ""))),
  [["a", "b", "c"], ["wide×2", "x"], ["continue×2", "y"], ["short", "pad", "pad"]]);

// ── exports ──
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
check("embeddable: PNG yes, WebP / web address no",
  embeddableImage(PNG, 10, 10)?.mime === "png" && !embeddableImage("data:image/webp;base64,AAAA") && !embeddableImage("https://x.test/a.png"));

const note: Note = {
  id: "n", title: "Charts", createdAt: 1, updatedAt: Date.UTC(2026, 9, 1),
  blocks: [chart({ id: "c1" }), chart({ id: "c2", title: "", points: [] })],
};
const tableModel = buildDocModel(note);
check("model: chart without a picture → title kept with a data table",
  tableModel.paragraphs[2].keepNext === true && tableModel.paragraphs[3].kind === "table" &&
  tableModel.paragraphs[3].table?.rows.length === 3);
check("model: empty chart says so", tableModel.paragraphs.some((p) => p.runs[0]?.text === "No data yet"));

const pictureModel = buildDocModel(note, { c1: embeddableImage(PNG, 360, 200, "")! });
check("model: chart picture used when given", pictureModel.paragraphs[3].kind === "image");
const files = docxFiles(pictureModel, pageSetupFor("en-IN"));
const xml = strFromU8(files["word/document.xml"]);
check("docx: picture embedded as media with a relationship",
  "word/media/image1.png" in files &&
  strFromU8(files["word/_rels/document.xml.rels"]).includes('Target="media/image1.png"') &&
  xml.includes('<a:blip r:embed="rIdImg1"/>') &&
  strFromU8(files["[Content_Types].xml"]).includes('Extension="png"'));
check("docx: chart title keeps with its picture", xml.includes("<w:keepNext/>"));

const tableXml = strFromU8(docxFiles(tableModel, pageSetupFor("en-IN"))["word/document.xml"]);
check("docx: data table is a real table, header row repeats", tableXml.includes("<w:tbl>") && tableXml.includes("<w:tblHeader/>"));
check("docx: ends with a paragraph after a table", /<\/w:tbl>(<w:p>.*?<\/w:p>|<w:p\/>)*<w:sectPr>/.test(tableXml));

const rtf = docToRtf(pictureModel, pageSetupFor("en-IN"));
check("rtf: picture as hex PNG", rtf.includes("{\\pict\\pngblip\\picw360\\pich200") && rtf.includes("89504e47"));
const rtfTable = docToRtf(tableModel, pageSetupFor("en-IN"));
check("rtf: table rows and cells", rtfTable.includes("\\trowd") && (rtfTable.match(/\\cell(?![a-z])/g) ?? []).length === 6 && (rtfTable.match(/\\row/g) ?? []).length === 3);
check("rtf: braces balanced", [...rtfTable.replace(/\\[\\{}]/g, "")].reduce((n, c) => n + (c === "{" ? 1 : c === "}" ? -1 : 0), 0) === 0);

const md = noteToMarkdown(note);
check("markdown: chart as a table", md.includes("**Sales \\<2026\\>** (bar chart)") && md.includes("| Label | Value |") && md.includes("| Jan | 1,200 |"), md);
check("markdown: empty chart noted", md.includes("*chart, no data yet*"));

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
