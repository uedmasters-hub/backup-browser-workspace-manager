import { create } from "zustand";

import { getNotes, saveNotes } from "../browser/storage/notesRepository";

import type {
  Note,
  NoteBlock,
  NoteBlockType,
} from "../types/notes";

function uid(): string {
  return crypto.randomUUID();
}

function createBlock(type: NoteBlockType, id = uid()): NoteBlock {
  switch (type) {
    case "text":
      return { id, type, text: "" };
    case "checklist":
      return { id, type, items: [{ id: uid(), text: "", done: false }] };
    case "link":
      return { id, type, label: "", url: "" };
    case "callout":
      return { id, type, text: "", tone: "info" };
    case "divider":
      return { id, type };
    case "password":
      return { id, type, label: "" };
  }
}

/** A text block is focusable; a divider/password is not auto-focused. */
function isFocusable(type: NoteBlockType): boolean {
  return type === "text" || type === "checklist" || type === "link" || type === "callout";
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

// Session PIN for the currently revealed locked note (memory only).
let revealPin: string | undefined;

interface NotesState {
  notes: Note[];
  activeNoteId?: string;
  query: string;
  loading: boolean;
  focusBlockId?: string;
  /** Locked note currently decrypted for viewing this session. */
  revealedId?: string;
}

interface NotesActions {
  loadNotes: () => Promise<void>;
  setQuery: (query: string) => void;

  createNote: () => string;
  deleteNote: (id: string) => void;
  lockNote: (id: string, pin: string) => Promise<void>;
  removeLock: (id: string) => void;
  revealNote: (id: string, pin: string) => Promise<boolean>;
  verifyNotePin: (id: string, pin: string) => Promise<boolean>;
  openNote: (id: string) => Promise<void>;
  closeNote: () => Promise<void>;
  updateNoteTitle: (id: string, title: string) => void;

  addBlock: (type: NoteBlockType) => string;
  addBlockAfter: (afterId: string, type: NoteBlockType) => string;
  addLineAfter: (id: string) => string;
  ensureTrailingBlock: () => void;
  transformBlock: (id: string, type: NoteBlockType) => void;
  updateBlock: (id: string, patch: Partial<NoteBlock>) => void;
  deleteBlock: (id: string) => void;
  deleteBlockFocusPrev: (id: string) => void;
  moveBlock: (id: string, direction: -1 | 1) => void;

  consumeFocus: () => void;
}

import {
  encryptSecret,
  decryptSecret,
} from "../browser/notes/passwordCrypto";

type NotesStore = NotesState & NotesActions;

export const useNotesStore = create<NotesStore>((set, get) => {
  // Never write plaintext for a locked note: encrypt the revealed note's
  // blocks; keep ciphertext (and empty blocks) for locked notes at rest.
  async function buildStorageSnapshot(): Promise<Note[]> {
    const { notes, revealedId } = get();
    return Promise.all(
      notes.map(async (n) => {
        if (!n.locked) {
          return n;
        }
        if (n.id === revealedId && revealPin) {
          const cipher = await encryptSecret(
            JSON.stringify(n.blocks),
            revealPin
          );
          return { ...n, cipher, blocks: [] };
        }
        return { ...n, blocks: [] };
      })
    );
  }

  async function persistNow() {
    await saveNotes(await buildStorageSnapshot());
  }

  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void persistNow();
    }, 350);
  }

  // Encrypt + save the revealed note, then drop its plaintext from memory.
  async function flushAndHide() {
    const id = get().revealedId;
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    await persistNow();
    revealPin = undefined;
    // Clear reveal + plaintext in a single update so the editor never sees a
    // transient "unlocked but empty" state (which would add a stray block).
    set((state) => ({
      revealedId: undefined,
      notes: id
        ? state.notes.map((n) =>
            n.id === id && n.locked ? { ...n, blocks: [] } : n
          )
        : state.notes,
    }));
  }

  function activeNote(): Note | undefined {
    return get().notes.find((n) => n.id === get().activeNoteId);
  }

  function isEmptyText(block: NoteBlock | undefined): boolean {
    return Boolean(
      block && block.type === "text" && block.text.trim() === ""
    );
  }

  /** Map the active note's blocks, bumping updatedAt. */
  function mutateActive(fn: (blocks: NoteBlock[]) => NoteBlock[]) {
    const { activeNoteId } = get();
    if (!activeNoteId) return;
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === activeNoteId
          ? { ...note, blocks: fn(note.blocks), updatedAt: Date.now() }
          : note
      ),
    }));
    persist();
  }

  return {
    notes: [],
    activeNoteId: undefined,
    query: "",
    loading: false,
    focusBlockId: undefined,
    revealedId: undefined,

    loadNotes: async () => {
      set({ loading: true });
      const notes = await getNotes();
      set({ notes, loading: false });
    },

    setQuery: (query) => set({ query }),

    createNote: () => {
      const first = createBlock("text");
      const note: Note = {
        id: uid(),
        title: "",
        blocks: [first],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set((state) => ({
        notes: [note, ...state.notes],
        activeNoteId: note.id,
        query: "",
        focusBlockId: first.id,
      }));
      persist();
      return note.id;
    },

    deleteNote: (id) => {
      set((state) => ({
        notes: state.notes.filter((n) => n.id !== id),
        activeNoteId:
          state.activeNoteId === id ? undefined : state.activeNoteId,
      }));
      persist();
    },

    // Encrypt the note's content with the PIN. Stays revealed for editing;
    // it is stored encrypted and re-secured when you leave it.
    lockNote: async (id, pin) => {
      const note = get().notes.find((n) => n.id === id);
      if (!note) {
        return;
      }
      const cipher = await encryptSecret(
        JSON.stringify(note.blocks),
        pin
      );
      revealPin = pin;
      set((state) => ({
        revealedId: id,
        notes: state.notes.map((n) =>
          n.id === id
            ? { ...n, locked: true, cipher, updatedAt: Date.now() }
            : n
        ),
      }));
      persist();
    },

    // Decrypt for this session so the content can be viewed/edited.
    revealNote: async (id, pin) => {
      const note = get().notes.find((n) => n.id === id);
      if (!note?.cipher) {
        return false;
      }
      try {
        const json = await decryptSecret(note.cipher, pin);
        const blocks = JSON.parse(json) as NoteBlock[];
        revealPin = pin;
        set((state) => ({
          revealedId: id,
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, blocks } : n
          ),
        }));
        return true;
      } catch {
        return false;
      }
    },

    // Remove protection entirely (must be revealed first; uses session PIN).
    removeLock: (id) => {
      set((state) => ({
        revealedId:
          state.revealedId === id ? undefined : state.revealedId,
        notes: state.notes.map((n) =>
          n.id === id
            ? { ...n, locked: false, cipher: undefined, updatedAt: Date.now() }
            : n
        ),
      }));
      revealPin = undefined;
      persist();
    },

    verifyNotePin: async (id, pin) => {
      const note = get().notes.find((n) => n.id === id);
      if (!note?.cipher) {
        return true;
      }
      try {
        await decryptSecret(note.cipher, pin);
        return true;
      } catch {
        return false;
      }
    },

    openNote: async (id) => {
      if (get().revealedId && get().revealedId !== id) {
        await flushAndHide();
      }
      set({ activeNoteId: id, query: "" });
    },

    closeNote: async () => {
      await flushAndHide();
      set({ activeNoteId: undefined, query: "" });
    },

    updateNoteTitle: (id, title) => {
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, title, updatedAt: Date.now() } : n
        ),
      }));
      persist();
    },

    addBlock: (type) => {
      const block = createBlock(type);
      mutateActive((blocks) => [...blocks, block]);
      if (isFocusable(type)) set({ focusBlockId: block.id });
      return block.id;
    },

    addBlockAfter: (afterId, type) => {
      const block = createBlock(type);
      mutateActive((blocks) => {
        const i = blocks.findIndex((b) => b.id === afterId);
        const next = [...blocks];
        next.splice(i < 0 ? blocks.length : i + 1, 0, block);
        return next;
      });
      if (isFocusable(type)) set({ focusBlockId: block.id });
      return block.id;
    },

    // Enter from a text block: reuse the empty line below if there is one,
    // otherwise insert a fresh text block — never creating duplicate blanks.
    addLineAfter: (id) => {
      const note = activeNote();
      if (!note) return id;
      const index = note.blocks.findIndex((b) => b.id === id);
      const next = note.blocks[index + 1];

      if (isEmptyText(next)) {
        set({ focusBlockId: next.id });
        return next.id;
      }

      const block = createBlock("text");
      mutateActive((blocks) => {
        const out = [...blocks];
        out.splice(index < 0 ? blocks.length : index + 1, 0, block);
        return out;
      });
      set({ focusBlockId: block.id });
      return block.id;
    },

    // Keeps a single empty text block at the end so there is always a place
    // to type after any block — no Enter required. Idempotent + no focus steal.
    ensureTrailingBlock: () => {
      const note = activeNote();
      if (!note) return;
      if (note.locked && get().revealedId !== note.id) {
        return;
      }
      const blocks = note.blocks;

      // Index just past the last meaningful block.
      let end = blocks.length;
      while (end > 0 && isEmptyText(blocks[end - 1])) {
        end -= 1;
      }
      const trailingEmpties = blocks.length - end;

      // Exactly one trailing empty line already → nothing to do.
      if (trailingEmpties === 1) {
        return;
      }

      const head = blocks.slice(0, end);
      // Keep the first existing trailing empty (preserves focus/id) or make one.
      const tail =
        trailingEmpties >= 1 ? [blocks[end]] : [createBlock("text")];
      const next = [...head, ...tail];

      mutateActive(() => next);
    },

    transformBlock: (id, type) => {
      mutateActive((blocks) =>
        blocks.map((b) => (b.id === id ? createBlock(type, id) : b))
      );
      if (isFocusable(type)) set({ focusBlockId: id });
    },

    updateBlock: (id, patch) => {
      mutateActive((blocks) =>
        blocks.map((b) =>
          b.id === id ? ({ ...b, ...patch } as NoteBlock) : b
        )
      );
    },

    deleteBlock: (id) => {
      mutateActive((blocks) => blocks.filter((b) => b.id !== id));
    },

    deleteBlockFocusPrev: (id) => {
      const note = activeNote();
      if (!note) return;
      const index = note.blocks.findIndex((b) => b.id === id);
      const prev = note.blocks[index - 1];
      mutateActive((blocks) => blocks.filter((b) => b.id !== id));
      if (prev && isFocusable(prev.type)) {
        set({ focusBlockId: prev.id });
      }
    },

    moveBlock: (id, direction) => {
      mutateActive((blocks) => {
        const index = blocks.findIndex((b) => b.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= blocks.length) {
          return blocks;
        }
        const next = [...blocks];
        const [moved] = next.splice(index, 1);
        next.splice(target, 0, moved);
        return next;
      });
    },

    consumeFocus: () => set({ focusBlockId: undefined }),
  };
});
