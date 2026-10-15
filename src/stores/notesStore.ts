import { create } from "zustand";

import {
  getNoteProjects,
  getNotes,
  saveNoteProjects,
  saveNotes,
} from "../browser/storage/notesRepository";
import { mergeTextBlocks, type RichPart } from "../components/popup/notes/richText";

import type {
  Note,
  NoteBlock,
  NoteBlockType,
  NoteProject,
} from "../types/notes";

/** Soft accents for project icons, picked in turn. */
export const PROJECT_COLORS = [
  "#6366F1",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#EF4444",
  "#14B8A6",
];

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
  projects: NoteProject[];
  /** Project being browsed (list view); undefined = all notes. */
  activeProjectId?: string;
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

  /** New note — inside `projectId`, or the open project, or standalone. */
  createNote: (projectId?: string | null) => string;
  createProject: (name: string) => string;
  renameProject: (id: string, name: string) => void;
  /** Removes the project; its notes are kept as standalone notes. */
  deleteProject: (id: string) => void;
  /** Browse a project (undefined = back to all notes). */
  openProject: (id: string | undefined) => void;
  /** Put a note in a project, or take it out (null). */
  moveNote: (noteId: string, projectId: string | null) => void;
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
  /**
   * Slash menu inside a Text block: keep what's above (`before`), insert the
   * chosen block, then what's below (`after`) as a new Text block.
   */
  splitTextBlock: (
    id: string,
    before: RichPart | null,
    type: NoteBlockType,
    after: RichPart | null
  ) => void;
  /** Join neighbouring Text blocks (older notes kept one line per block). */
  normalizeTextBlocks: () => void;
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

  /**
   * Map the active note's blocks, bumping updatedAt — unless `touch` is false
   * (tidy-ups that aren't the user's edits, so the note doesn't jump to the top).
   */
  function mutateActive(
    fn: (blocks: NoteBlock[]) => NoteBlock[],
    { touch = true }: { touch?: boolean } = {}
  ) {
    const { activeNoteId } = get();
    if (!activeNoteId) return;
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === activeNoteId
          ? {
              ...note,
              blocks: fn(note.blocks),
              updatedAt: touch ? Date.now() : note.updatedAt,
            }
          : note
      ),
    }));
    persist();
  }

  function saveProjects() {
    void saveNoteProjects(get().projects);
  }

  return {
    notes: [],
    projects: [],
    activeProjectId: undefined,
    activeNoteId: undefined,
    query: "",
    loading: false,
    focusBlockId: undefined,
    revealedId: undefined,

    loadNotes: async () => {
      set({ loading: true });
      const [notes, projects] = await Promise.all([getNotes(), getNoteProjects()]);
      const ids = new Set(projects.map((p) => p.id));
      set((state) => ({
        // A note pointing at a project that no longer exists is standalone.
        notes: notes.map((n) =>
          n.projectId && !ids.has(n.projectId) ? { ...n, projectId: undefined } : n
        ),
        projects,
        loading: false,
        activeProjectId:
          state.activeProjectId && ids.has(state.activeProjectId)
            ? state.activeProjectId
            : undefined,
      }));
    },

    setQuery: (query) => set({ query }),

    createNote: (projectId) => {
      const first = createBlock("text");
      const target = projectId === undefined ? get().activeProjectId : projectId ?? undefined;
      const note: Note = {
        id: uid(),
        title: "",
        blocks: [first],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...(target ? { projectId: target } : {}),
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

    createProject: (name) => {
      const { projects } = get();
      const project: NoteProject = {
        id: uid(),
        name: name.trim() || "Untitled project",
        color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set({ projects: [project, ...projects] });
      saveProjects();
      return project.id;
    },

    renameProject: (id, name) => {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, name, updatedAt: Date.now() } : p
        ),
      }));
      saveProjects();
    },

    deleteProject: (id) => {
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        notes: state.notes.map((n) =>
          n.projectId === id ? { ...n, projectId: undefined } : n
        ),
        activeProjectId:
          state.activeProjectId === id ? undefined : state.activeProjectId,
      }));
      saveProjects();
      persist();
    },

    openProject: (id) => {
      set({ activeProjectId: id, query: "" });
    },

    moveNote: (noteId, projectId) => {
      const target = projectId && get().projects.some((p) => p.id === projectId) ? projectId : undefined;
      set((state) => ({
        notes: state.notes.map((n) => {
          if (n.id !== noteId || n.projectId === target) return n;
          const { projectId: _old, ...rest } = n;
          void _old;
          // Moving isn't an edit — the note keeps its place in time.
          return target ? { ...rest, projectId: target } : rest;
        }),
        projects: target
          ? state.projects.map((p) => (p.id === target ? { ...p, updatedAt: Date.now() } : p))
          : state.projects,
      }));
      if (target) saveProjects();
      persist();
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

    // There's always somewhere to type at the end: a Text block holds many
    // lines, so one is only added after a non-text block (checklist, link,
    // divider…). Extra trailing empty lines are dropped. No focus steal.
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
      const lastMeaningful = blocks[end - 1];
      const needsLine = !lastMeaningful || lastMeaningful.type !== "text";
      const wanted = needsLine ? 1 : 0;
      if (blocks.length - end === wanted) {
        return;
      }

      const head = blocks.slice(0, end);
      // Reuse the first existing trailing empty (keeps its id/focus) or make one.
      const tail = needsLine ? [blocks[end] ?? createBlock("text")] : [];
      mutateActive(() => [...head, ...tail]);
    },

    transformBlock: (id, type) => {
      mutateActive((blocks) =>
        blocks.map((b) => (b.id === id ? createBlock(type, id) : b))
      );
      if (isFocusable(type)) set({ focusBlockId: id });
    },

    splitTextBlock: (id, before, type, after) => {
      let focusId: string | undefined;
      mutateActive((blocks) => {
        const i = blocks.findIndex((b) => b.id === id);
        if (i < 0) return blocks;
        const created = createBlock(type, before ? uid() : id);
        const replacement: NoteBlock[] = [];
        if (before) {
          replacement.push({ id, type: "text", text: before.text, html: before.html });
        }
        replacement.push(created);
        if (after) {
          replacement.push({ id: uid(), type: "text", text: after.text, html: after.html });
        }
        focusId = created.id;
        const out = [...blocks];
        out.splice(i, 1, ...replacement);
        return out;
      });
      if (focusId && isFocusable(type)) set({ focusBlockId: focusId });
    },

    normalizeTextBlocks: () => {
      const note = activeNote();
      if (!note || mergeTextBlocks(note.blocks) === note.blocks) return;
      mutateActive(mergeTextBlocks, { touch: false });
    },

    updateBlock: (id, patch) => {
      mutateActive((blocks) =>
        blocks.map((b) =>
          b.id === id ? ({ ...b, ...patch } as NoteBlock) : b
        )
      );
    },

    deleteBlock: (id) => {
      // Removing e.g. a divider between two Text blocks joins them.
      mutateActive((blocks) => mergeTextBlocks(blocks.filter((b) => b.id !== id)));
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
