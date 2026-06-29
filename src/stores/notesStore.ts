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

interface NotesState {
  notes: Note[];
  activeNoteId?: string;
  query: string;
  loading: boolean;
  focusBlockId?: string;
}

interface NotesActions {
  loadNotes: () => Promise<void>;
  setQuery: (query: string) => void;

  createNote: () => string;
  deleteNote: (id: string) => void;
  lockNote: (id: string, pin: string) => Promise<void>;
  unlockNote: (id: string, pin: string) => Promise<boolean>;
  verifyNotePin: (id: string, pin: string) => Promise<boolean>;
  openNote: (id: string) => void;
  closeNote: () => void;
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

const LOCK_TOKEN = "bwm-note-lock";

type NotesStore = NotesState & NotesActions;

export const useNotesStore = create<NotesStore>((set, get) => {
  function persist() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveNotes(get().notes);
    }, 350);
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

    lockNote: async (id, pin) => {
      const lock = await encryptSecret(LOCK_TOKEN, pin);
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, lock, updatedAt: Date.now() } : n
        ),
      }));
      persist();
    },

    verifyNotePin: async (id, pin) => {
      const note = get().notes.find((n) => n.id === id);
      if (!note?.lock) {
        return true;
      }
      try {
        return (await decryptSecret(note.lock, pin)) === LOCK_TOKEN;
      } catch {
        return false;
      }
    },

    unlockNote: async (id, pin) => {
      const ok = await get().verifyNotePin(id, pin);
      if (!ok) {
        return false;
      }
      set((state) => ({
        notes: state.notes.map((n) =>
          n.id === id ? { ...n, lock: undefined, updatedAt: Date.now() } : n
        ),
      }));
      persist();
      return true;
    },

    openNote: (id) => set({ activeNoteId: id, query: "" }),

    closeNote: () => set({ activeNoteId: undefined, query: "" }),

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
      const last = note.blocks[note.blocks.length - 1];
      if (isEmptyText(last)) return;
      const block = createBlock("text");
      mutateActive((blocks) => [...blocks, block]);
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
