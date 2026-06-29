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

    // content -> gets exactly one trailing empty
    S().updateBlock(blocks()[0].id, { text: "hello" } as Partial<NoteBlock>);
    S().ensureTrailingBlock();
    check(
      "content gains one trailing empty",
      blocks().length === 2 &&
        !isBlank(blocks()[0]) &&
        isBlank(blocks()[1])
    );

    // two trailing empties collapse to one
    S().addBlockAfter(blocks()[1].id, "text");
    check("manually created a second trailing empty", blocks().length === 3);
    S().ensureTrailingBlock();
    check("double trailing empties collapse to one", blocks().length === 2);

    S().deleteNote(id);
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
