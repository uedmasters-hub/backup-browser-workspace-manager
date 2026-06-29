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
  S().closeNote();
  check("closeNote returns to list", S().activeNoteId === undefined);
  await S().loadNotes();
  check("reload restores every note", S().notes.length === 2);

  // ---- per-note PIN lock (delete protection) ----
  {
    const id = S().createNote();
    S().updateNoteTitle(id, "Secret");

    const before = S().notes.find((n) => n.id === id);
    check("new note is unlocked", !before?.lock);
    check(
      "verify returns true when no lock set",
      (await S().verifyNotePin(id, "anything")) === true
    );

    await S().lockNote(id, "1234");
    const locked = S().notes.find((n) => n.id === id);
    check("lockNote stores a lock cipher", Boolean(locked?.lock));

    check(
      "correct PIN verifies",
      (await S().verifyNotePin(id, "1234")) === true
    );
    check(
      "wrong PIN fails",
      (await S().verifyNotePin(id, "0000")) === false
    );

    check(
      "unlock with wrong PIN is rejected",
      (await S().unlockNote(id, "0000")) === false &&
        Boolean(S().notes.find((n) => n.id === id)?.lock)
    );
    check(
      "unlock with correct PIN removes the lock",
      (await S().unlockNote(id, "1234")) === true &&
        !S().notes.find((n) => n.id === id)?.lock
    );

    S().deleteNote(id);
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
