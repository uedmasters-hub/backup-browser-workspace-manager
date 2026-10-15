/**
 * Notes harness: per-block PIN crypto + global multi-note store
 * (create, slash-transform, insert-after, reorder, title, export,
 * persistence across the whole collection). Runs under Node.
 */

const STORE: Record<string, unknown> = {};

(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (key: string) => (key in STORE ? { [key]: STORE[key] } : {}),
      set: async (obj: Record<string, unknown>) => {
        Object.assign(STORE, obj);
      },
    },
  },
};

import {
  encryptSecret,
  decryptSecret,
} from "../src/browser/notes/passwordCrypto";
import { useNotesStore } from "../src/stores/notesStore";
import { noteToText } from "../src/components/popup/notes/serialize";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${label}`);
  } else {
    failed++;
    console.log(`  \u2717 ${label}${detail ? ` -> ${detail}` : ""}`);
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const S = () => useNotesStore.getState();
function isBlank(b: { type: string; text?: string }): boolean {
  return b.type === "text" && (b.text ?? "").trim() === "";
}
const active = () => S().notes.find((n) => n.id === S().activeNoteId);

async function run() {
  console.log("NOTES HARNESS");

  // crypto
  const enc = await encryptSecret("hunter2", "4821");
  check("encrypt/decrypt round-trips", (await decryptSecret(enc, "4821")) === "hunter2");
  let threw = false;
  try { await decryptSecret(enc, "0000"); } catch { threw = true; }
  check("wrong PIN rejected", threw);
  const enc2 = await encryptSecret("hunter2", "4821");
  check("non-deterministic ciphertext", enc.cipher !== enc2.cipher);

  // global store starts empty
  await S().loadNotes();
  check("notes start empty (global)", S().notes.length === 0);

  // create -> not blank, focused
  const id = S().createNote();
  check("createNote adds a note", S().notes.length === 1);
  check("new note opens active", S().activeNoteId === id);
  check("new note is not blank (has a text block)", active()!.blocks.length === 1 && active()!.blocks[0].type === "text");
  check("first block is focus-targeted", S().focusBlockId === active()!.blocks[0].id);

  // strictly not against blank: a blank last block gets no trailing line
  S().ensureTrailingBlock();
  check("no trailing line added against a blank block", active()!.blocks.length === 1);

  // slash transform of the first block -> checklist
  const firstId = active()!.blocks[0].id;
  S().transformBlock(firstId, "checklist");
  check("transformBlock changes type, keeps id", active()!.blocks[0].id === firstId && active()!.blocks[0].type === "checklist");

  // insert after + append
  S().addBlockAfter(firstId, "text");
  const linkId = S().addBlock("link");
  check("addBlockAfter + addBlock grow the note", active()!.blocks.length === 3);
  S().moveBlock(linkId, -1);
  check("moveBlock reorders", active()!.blocks[1].id === linkId);

  // title + export
  S().updateNoteTitle(id, "Trip plan");
  const text = noteToText(active()!);
  check("export includes the title", text.startsWith("# Trip plan"));

  // delete a block
  S().deleteBlock(linkId);
  check("deleteBlock removes", !active()!.blocks.some((b) => b.id === linkId));

  // trailing-line invariant: a non-text block always gets a follow-up line
  const lastTextId = active()!.blocks[active()!.blocks.length - 1].id;
  S().transformBlock(lastTextId, "password");
  S().ensureTrailingBlock();
  const lastNow = () => active()!.blocks[active()!.blocks.length - 1];
  check(
    "non-text last block gets a trailing text line",
    lastNow().type === "text"
  );
  const lenWithTrailer = active()!.blocks.length;
  S().ensureTrailingBlock();
  check(
    "ensureTrailingBlock is idempotent",
    active()!.blocks.length === lenWithTrailer
  );
  const trailingId = lastNow().id;
  const reused = S().addLineAfter(lastTextId);
  check(
    "Enter reuses the existing empty line (no duplicate blanks)",
    reused === trailingId && active()!.blocks.length === lenWithTrailer
  );

  // a second note + persistence of the whole collection
  S().createNote();
  check("multiple notes supported", S().notes.length === 2);
  await sleep(450);
  check("collection persisted", Array.isArray(STORE.workspaceNotes) && (STORE.workspaceNotes as unknown[]).length === 2);

  // reload restores all
  await S().closeNote();
  check("closeNote returns to list", S().activeNoteId === undefined);
  await S().loadNotes();
  check("reload restores every note", S().notes.length === 2);

  // ---- per-note PIN lock: encryption-at-rest + session reveal ----
  {
    const id = S().createNote();
    S().updateNoteTitle(id, "Secret");
    const bid = S().notes.find((n) => n.id === id)!.blocks[0].id;
    S().updateBlock(bid, { text: "top secret" } as Partial<NoteBlock>);

    check("new note is unlocked", !S().notes.find((n) => n.id === id)?.locked);
    check(
      "verify true when not locked",
      (await S().verifyNotePin(id, "x")) === true
    );

    await S().lockNote(id, "1234");
    let note = S().notes.find((n) => n.id === id)!;
    check(
      "lockNote sets locked + cipher",
      note.locked === true && Boolean(note.cipher)
    );
    check(
      "stays revealed for editing right after locking",
      S().revealedId === id && note.blocks.length > 0
    );

    check("correct PIN verifies", (await S().verifyNotePin(id, "1234")) === true);
    check("wrong PIN fails", (await S().verifyNotePin(id, "0000")) === false);

    // leaving the note re-secures it: plaintext dropped, cipher kept
    await S().closeNote();
    note = S().notes.find((n) => n.id === id)!;
    check(
      "closing hides plaintext",
      note.blocks.length === 0 && S().revealedId === undefined
    );
    check("cipher retained at rest", Boolean(note.cipher));

    await S().openNote(id);
    check("reopened note stays hidden", S().revealedId !== id);

    check("reveal with wrong PIN fails", (await S().revealNote(id, "0000")) === false);
    const ok = await S().revealNote(id, "1234");
    note = S().notes.find((n) => n.id === id)!;
    const restored = note.blocks.some(
      (b) => b.type === "text" && (b as { text?: string }).text === "top secret"
    );
    check("reveal with correct PIN restores content", ok === true && restored);

    S().removeLock(id);
    note = S().notes.find((n) => n.id === id)!;
    check("removeLock clears lock + cipher", !note.locked && !note.cipher);

    S().deleteNote(id);
  }

  // ---- trailing empty normalization (no double blanks) ----
  {
    const id = S().createNote();
    const blocks = () => S().notes.find((n) => n.id === id)!.blocks;

    // single empty note stays single
    S().ensureTrailingBlock();
    check("empty note keeps exactly one block", blocks().length === 1);

    // a Text block with content holds many lines — no extra empty line after it
    S().updateBlock(blocks()[0].id, { text: "hello" } as Partial<NoteBlock>);
    S().ensureTrailingBlock();
    check("text with content needs no trailing empty line", blocks().length === 1);

    // stray empty lines after a Text block are tidied away
    S().addBlockAfter(blocks()[0].id, "text");
    S().addBlockAfter(blocks()[1].id, "text");
    check("manually created two trailing empties", blocks().length === 3);
    S().ensureTrailingBlock();
    check("trailing empties after text are removed", blocks().length === 1);

    // after a non-text block: exactly one empty line, even if there were two
    const divId = S().addBlockAfter(blocks()[0].id, "divider");
    S().addBlockAfter(divId, "text");
    S().addBlockAfter(divId, "text");
    S().ensureTrailingBlock();
    check(
      "after a divider: exactly one trailing empty",
      blocks().length === 3 && blocks()[1].type === "divider" && isBlank(blocks()[2])
    );

    S().deleteNote(id);
  }

  // ---- rich text: slash split, merging, legacy notes ----
  {
    const id = S().createNote();
    const blocks = () => S().notes.find((n) => n.id === id)!.blocks;
    const textId = blocks()[0].id;
    S().updateBlock(textId, { text: "above\nbelow", html: "<p>above</p><p>/</p><p>below</p>" } as Partial<NoteBlock>);

    S().splitTextBlock(
      textId,
      { html: "<p>above</p>", text: "above" },
      "checklist",
      { html: "<p>below</p>", text: "below" }
    );
    const [a, b, c] = blocks();
    check(
      "slash split: text above · new block · text below",
      blocks().length === 3 && a.id === textId && a.type === "text" && b.type === "checklist" && c.type === "text"
    );
    check("slash split: focus goes to the new block", S().focusBlockId === b.id);
    check(
      "slash split: content kept on both sides",
      (a as { html?: string }).html === "<p>above</p>" && (c as { text: string }).text === "below"
    );

    // removing the block between two Text blocks joins them
    S().deleteBlock(b.id);
    check(
      "delete between two text blocks merges them",
      blocks().length === 1 &&
        (blocks()[0] as { html?: string }).html === "<p>above</p><p>below</p>" &&
        (blocks()[0] as { text: string }).text === "above\nbelow"
    );

    // split with nothing above: the block itself becomes the new type
    S().splitTextBlock(blocks()[0].id, null, "callout", { html: "<p>rest</p>", text: "rest" });
    check(
      "slash split at top: block turns into the new type, rest follows",
      blocks()[0].id === textId && blocks()[0].type === "callout" && blocks()[1].type === "text"
    );

    // older notes (one line per block) are joined once on open
    S().deleteNote(id);
    const legacy = S().createNote();
    const lb = () => S().notes.find((n) => n.id === legacy)!.blocks;
    S().updateBlock(lb()[0].id, { text: "line one" } as Partial<NoteBlock>);
    const second = S().addBlockAfter(lb()[0].id, "text");
    S().updateBlock(second, { text: "line two" } as Partial<NoteBlock>);
    const editedAt = S().notes.find((n) => n.id === legacy)!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    S().normalizeTextBlocks();
    check("joining on open doesn't count as an edit (note keeps its place)",
      S().notes.find((n) => n.id === legacy)!.updatedAt === editedAt);
    check(
      "legacy one-line-per-block notes join into one rich block",
      lb().length === 1 && (lb()[0] as { text: string }).text === "line one\nline two" &&
        (lb()[0] as { html?: string }).html === "<p>line one</p><p>line two</p>"
    );
    const before = S().notes.find((n) => n.id === legacy)!.updatedAt;
    S().normalizeTextBlocks();
    check("normalize is a no-op when nothing to join (no needless save)",
      S().notes.find((n) => n.id === legacy)!.updatedAt === before);
    S().deleteNote(legacy);
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
