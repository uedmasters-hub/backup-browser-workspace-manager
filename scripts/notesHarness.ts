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

  // ---- projects ----
  {
    const note = (id: string) => S().notes.find((n) => n.id === id);
    const standaloneId = S().createNote(null);
    check("a new note is standalone by default", note(standaloneId)!.projectId === undefined);

    const projectId = S().createProject("  eMedicalls  ");
    const project = () => S().projects.find((p) => p.id === projectId);
    check("createProject trims the name and gives it a colour", project()?.name === "eMedicalls" && /^#[0-9A-F]{6}$/i.test(project()!.color));
    await new Promise((r) => setTimeout(r, 20)); // saves are queued
    check("projects persisted", Array.isArray(STORE.noteProjects) && (STORE.noteProjects as unknown[]).length === 1);

    const inProject = S().createNote(projectId);
    check("createNote(projectId) puts the note in the project", note(inProject)!.projectId === projectId);
    S().closeNote();

    S().openProject(projectId);
    const viaView = S().createNote();
    check("New note while browsing a project lands in it", note(viaView)!.projectId === projectId);
    S().closeNote();
    check("closing a note keeps you in the project", S().activeProjectId === projectId);
    const forcedStandalone = S().createNote(null);
    check("createNote(null) stays standalone even inside a project view", note(forcedStandalone)!.projectId === undefined);
    S().closeNote();
    S().openProject(undefined);

    const before = note(standaloneId)!.updatedAt;
    await new Promise((r) => setTimeout(r, 5));
    S().moveNote(standaloneId, projectId);
    check("moveNote into a project", note(standaloneId)!.projectId === projectId);
    check("moving isn't an edit (note keeps its time)", note(standaloneId)!.updatedAt === before);
    S().moveNote(standaloneId, null);
    check("moveNote(null) takes it out", note(standaloneId)!.projectId === undefined && !("projectId" in note(standaloneId)!));
    S().moveNote(standaloneId, "no-such-project");
    check("moving to an unknown project leaves it standalone", note(standaloneId)!.projectId === undefined);

    S().renameProject(projectId, "eMedicalls v2");
    check("renameProject", project()?.name === "eMedicalls v2");

    S().openProject(projectId);
    S().deleteProject(projectId);
    check("deleteProject removes the project", !project());
    check("…but keeps its notes, now standalone", note(inProject)!.projectId === undefined && note(viaView)!.projectId === undefined);
    check("…and leaves the project view", S().activeProjectId === undefined);

    // A note pointing at a vanished project is treated as standalone on load.
    STORE.workspaceNotes = [{ id: "orphan", title: "x", blocks: [], createdAt: 1, updatedAt: 1, projectId: "gone" }];
    STORE.noteProjects = [];
    await S().loadNotes();
    check("dangling projectId is cleared on load", S().notes[0].projectId === undefined);

    for (const id of [standaloneId, inProject, viaView, forcedStandalone]) S().deleteNote(id);
  }

  // ---- locked projects ----
  {
    const settle = () => new Promise((r) => setTimeout(r, 30));
    const note = (id: string) => S().notes.find((n) => n.id === id);
    const pid = S().createProject("Vault");
    const a = S().createNote(pid);
    S().updateNoteTitle(a, "Salary review");
    S().updateBlock(S().notes.find((n) => n.id === a)!.blocks[0].id, { text: "Top secret plan" } as Partial<NoteBlock>);
    S().closeNote();
    const b = S().createNote(pid);
    S().updateNoteTitle(b, "Separately locked");
    await S().lockNote(b, "9999");
    S().closeNote();
    await settle();

    S().openProject(pid);
    await S().lockProject(pid, "2468");
    const raw = JSON.stringify(STORE);
    check("locking seals titles and content — nothing readable in storage",
      !raw.includes("Salary review") && !raw.includes("Top secret plan") && !raw.includes("Separately locked"));
    check("sealed project stored with ciphertext", Boolean((STORE.noteProjects as { id: string; sealed?: unknown }[]).find((p) => p.id === pid)?.sealed));
    check("project stays open after locking (you're inside it)", S().unlockedProjectIds.includes(pid) && Boolean(note(a)));

    S().openProject(undefined); // leaving locks it again (encryption runs in the background)
    for (let i = 0; i < 200 && S().unlockedProjectIds.includes(pid); i++) await settle();
    check("leaving the project locks it and drops its notes from memory",
      !S().unlockedProjectIds.includes(pid) && !note(a) && !note(b));

    const stray = S().createNote(null);
    S().closeNote();
    S().moveNote(stray, pid);
    check("can't move a note into a closed locked project", note(stray)!.projectId === undefined);
    check("createNote(closed locked project) stays standalone", note(S().createNote(pid))!.projectId === undefined);
    S().closeNote();
    S().deleteProject(pid);
    check("can't delete a closed locked project", S().projects.some((p) => p.id === pid));

    check("wrong PIN refused", (await S().unlockProject(pid, "0000")) === false && !note(a));
    check("right PIN opens it", (await S().unlockProject(pid, "2468")) === true && note(a)?.title === "Salary review");
    check("…content restored", (note(a)!.blocks[0] as { text: string }).text === "Top secret plan");
    check("a locked note inside stays separately encrypted", note(b)!.locked === true && note(b)!.blocks.length === 0 && Boolean(note(b)!.cipher));

    // edit while open, lock, reopen — edit survives
    S().updateNoteTitle(a, "Salary review v2");
    await S().relockProject(pid);
    check("relock drops notes from memory", !note(a));
    await S().unlockProject(pid, "2468");
    check("edits made while open are sealed and come back", note(a)?.title === "Salary review v2");

    S().removeProjectLock(pid);
    for (let i = 0; i < 100 && JSON.stringify(STORE).includes('"sealed"'); i++) await settle();
    const after = JSON.stringify(STORE);
    check("removing the lock writes notes back in plain form",
      after.includes("Salary review v2") && !(STORE.noteProjects as { id: string; sealed?: unknown; locked?: boolean }[]).find((p) => p.id === pid)?.sealed);
    check("…and the individually locked note is still encrypted", !after.includes("Separately") || note(b)!.locked === true);

    S().deleteProject(pid);
    for (const id of [a, b, stray]) S().deleteNote(id);
    for (const n of S().notes.filter((n) => !n.projectId && n.title === "")) S().deleteNote(n.id);
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run();
