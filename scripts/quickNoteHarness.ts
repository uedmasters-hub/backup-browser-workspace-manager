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

// default title is the note name; body holds the text
{
  const n = buildNoteFromText("alkdsla jd");
  check("title is the note name", n.title === "Quick note");
  check("body keeps the full text", n.blocks.length === 1 && n.blocks[0].text === "alkdsla jd");
  check("blocks are text type", n.blocks.every((b) => b.type === "text"));
  check("has timestamps", n.createdAt > 0 && n.updatedAt > 0);
}

// empty -> one empty block, still named
{
  const n = buildNoteFromText("");
  check("empty -> default title", n.title === "Quick note");
  check("empty -> one empty block", n.blocks.length === 1 && n.blocks[0].text === "");
}

// multi-line body kept line by line (no line treated as title)
{
  const n = buildNoteFromText("first line\nsecond line\nthird");
  check("multiline title stays the name", n.title === "Quick note");
  check(
    "every line kept in body",
    n.blocks.length === 3 &&
      n.blocks[0].text === "first line" &&
      n.blocks[1].text === "second line" &&
      n.blocks[2].text === "third"
  );
}

// long single paragraph is NOT lost to the title
{
  const long = "x".repeat(300);
  const n = buildNoteFromText(long);
  check("long paragraph stays in body", n.blocks[0].text === long);
  check("title not overrun by body", n.title === "Quick note");
}

// optional custom title supported
{
  const n = buildNoteFromText("body here", "My title");
  check("custom title used", n.title === "My title");
  check("custom title body intact", n.blocks[0].text === "body here");
}

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
