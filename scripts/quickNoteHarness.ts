import { buildNoteFromText } from "../src/browser/content/quickNote";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.log(`  \u2717 ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

// empty text -> placeholder title + one empty block
{
  const n = buildNoteFromText("");
  check("empty -> default title", n.title === "Quick note");
  check("empty -> one empty block", n.blocks.length === 1 && n.blocks[0].text === "");
  check("blocks are text type", n.blocks.every((b) => b.type === "text"));
  check("has timestamps", n.createdAt > 0 && n.updatedAt > 0);
  check("unique ids", n.id !== n.blocks[0].id);
}

// single line -> title only, one empty body block
{
  const n = buildNoteFromText("Buy milk");
  check("single line title", n.title === "Buy milk");
  check("single line body keeps text", n.blocks.length === 1 && n.blocks[0].text === "Buy milk");
}

// multi-line -> first non-empty is title, rest are body blocks
{
  const n = buildNoteFromText("Groceries\nmilk\neggs");
  check("multiline title", n.title === "Groceries");
  check(
    "multiline body keeps all lines",
    n.blocks.length === 3 &&
      n.blocks[0].text === "Groceries" &&
      n.blocks[1].text === "milk" &&
      n.blocks[2].text === "eggs"
  );
}

// leading blank lines skipped for title
{
  const n = buildNoteFromText("\n\n  Real Title\nbody");
  check("leading blanks skipped for title", n.title === "Real Title");
  check(
    "body trims leading blanks and keeps content",
    n.blocks.length === 2 &&
      n.blocks[0].text.trim() === "Real Title" &&
      n.blocks[1].text === "body"
  );
}

// long title truncated to 100
{
  const long = "x".repeat(200);
  const n = buildNoteFromText(long);
  check("title truncated to 80", n.title.length === 80);
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
