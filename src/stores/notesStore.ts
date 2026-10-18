import { create } from "zustand";

import {
  getNoteProjects,
  getNotes,
  saveNotesAndProjects,
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
    case "chart":
      return {
        id,
        type,
        kind: "bar",
        title: "",
        points: [1, 2, 3].map(() => ({ id: uid(), label: "", value: null })),
      };
  }
}

/** A text block is focusable; a divider/password is not auto-focused. */
function isFocusable(type: NoteBlockType): boolean {
  return type === "text" || type === "checklist" || type === "link" || type === "callout" || type === "chart";
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

// Session PIN for the currently revealed locked note (memory only).
let revealPin: string | undefined;
// PINs of locked projects opened this session (memory only).
const projectPins = new Map<string, string>();
// Saves run one after another, so a slower save never overwrites a newer one.
let writeChain: Promise<void> = Promise.resolve();

interface NotesState {
  notes: Note[];
  projects: NoteProject[];
  /** Project being browsed (list view); undefined = all notes. */
  activeProjectId?: string;
  /** Locked projects opened (decrypted) this session. */
  unlockedProjectIds: string[];
  activeNoteId?: string;
  query: string;
  loading: boolean;
  focusBlockId?: string;
  /** Where the caret goes in `focusBlockId` (default: end). */
  focusAt?: "start" | "end";
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
  setProjectColor: (id: string, color: string) => void;
  /** Encrypt the project's notes with a PIN. It stays open until you leave it. */
  lockProject: (id: string, pin: string) => Promise<void>;
  /** Decrypt a locked project for this session. False = wrong PIN. */
  unlockProject: (id: string, pin: string) => Promise<boolean>;
  /** Seal an open locked project again and drop its notes from memory. */
  relockProject: (id: string) => Promise<void>;
  relockAllProjects: () => Promise<void>;
  /** Stop encrypting the project (it must be open). */
  removeProjectLock: (id: string) => void;
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

  /** Focus a block (Tab / arrows / clicks), caret at its start or end. */
  focusBlock: (id: string, at?: "start" | "end") => void;
  consumeFocus: () => void;
}

import {
  encryptSecret,
  decryptSecret,
} from "../browser/notes/passwordCrypto";

type NotesStore = NotesState & NotesActions;

export const useNotesStore = create<NotesStore>((set, get) => {
  // Never write plaintext for a locked note or a locked project:
  // - a locked note's blocks are encrypted (revealed one re-encrypted with the
  //   session PIN); at rest it keeps only ciphertext + empty blocks;
  // - an open locked project re-seals all its notes (titles and content) into
  //   `project.sealed`, and those notes are left out of the plain notes list.
  async function buildStorageSnapshot(): Promise<{ notes: Note[]; projects: NoteProject[] }> {
    const { notes, revealedId, projects } = get();
    const atRest = await Promise.all(
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

    const sealedIds = new Set<string>();
    const projectsAtRest = await Promise.all(
      projects.map(async (p) => {
        if (!p.locked) {
          if (!p.sealed) return p;
          const { sealed: _drop, ...plain } = p;
          void _drop;
          return plain;
        }
        const pin = projectPins.get(p.id);
        // Closed: its notes aren't in memory — keep the existing ciphertext.
        if (!pin) return p;
        sealedIds.add(p.id);
        const inside = atRest.filter((n) => n.projectId === p.id);
        return { ...p, sealed: await encryptSecret(JSON.stringify(inside), pin) };
      })
    );

    return {
      notes: atRest.filter((n) => !(n.projectId && sealedIds.has(n.projectId))),
      projects: projectsAtRest,
    };
  }

  function persistNow(): Promise<void> {
    writeChain = writeChain
      .then(async () => {
        const snapshot = await buildStorageSnapshot();
        await saveNotesAndProjects(snapshot.notes, snapshot.projects);
        // Keep the fresh ciphertext in memory too — it's what unlocking checks.
        const sealed = new Map(
          snapshot.projects.filter((p) => p.locked && p.sealed).map((p) => [p.id, p.sealed])
        );
        if (sealed.size) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.locked && sealed.has(p.id) && p.sealed !== sealed.get(p.id)
                ? { ...p, sealed: sealed.get(p.id) }
                : p
            ),
          }));
        }
      })
      .catch((error) => console.error("[notes] save failed", error));
    return writeChain;
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
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = undefined;
    }
    void persistNow();
  }

  function isClosedLocked(projectId: string | undefined): boolean {
    const p = projectId ? get().projects.find((x) => x.id === projectId) : undefined;
    return Boolean(p?.locked && !projectPins.has(p.id));
  }

  return {
    notes: [],
    projects: [],
    activeProjectId: undefined,
    unlockedProjectIds: [],
    activeNoteId: undefined,
    query: "",
    loading: false,
    focusBlockId: undefined,
    revealedId: undefined,

    loadNotes: async () => {
      // Reloading starts with every locked project closed again.
      if (projectPins.size) await get().relockAllProjects();
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
      let target = projectId === undefined ? get().activeProjectId : projectId ?? undefined;
      if (isClosedLocked(target)) target = undefined; // sealed — open it first

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
      // A closed locked project can't be emptied — its notes are sealed.
      if (isClosedLocked(id)) return;
      projectPins.delete(id);
      set((state) => ({
        unlockedProjectIds: state.unlockedProjectIds.filter((x) => x !== id),
        projects: state.projects.filter((p) => p.id !== id),
        notes: state.notes.map((n) =>
          n.projectId === id ? { ...n, projectId: undefined } : n
        ),
        activeProjectId:
          state.activeProjectId === id ? undefined : state.activeProjectId,
      }));
      saveProjects();
    },

    openProject: (id) => {
      const leaving = get().activeProjectId;
      // Leaving an open locked project locks it again.
      if (leaving && leaving !== id && projectPins.has(leaving)) {
        void get().relockProject(leaving);
      }
      set({ activeProjectId: id, query: "" });
    },

    setProjectColor: (id, color) => {
      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? { ...p, color } : p)),
      }));
      saveProjects();
    },

    lockProject: async (id, pin) => {
      projectPins.set(id, pin);
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === id ? { ...p, locked: true, updatedAt: Date.now() } : p
        ),
        unlockedProjectIds: [...new Set([...state.unlockedProjectIds, id])],
      }));
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = undefined;
      }
      await persistNow();
    },

    unlockProject: async (id, pin) => {
      const project = get().projects.find((p) => p.id === id);
      if (!project?.locked) return true;
      if (!project.sealed) return false; // nothing to check the PIN against
      try {
        const inside = JSON.parse(await decryptSecret(project.sealed, pin)) as Note[];
        projectPins.set(id, pin);
        set((state) => {
          const ids = new Set(inside.map((n) => n.id));
          return {
            notes: [...state.notes.filter((n) => !ids.has(n.id)), ...inside.map((n) => ({ ...n, projectId: id }))],
            unlockedProjectIds: [...new Set([...state.unlockedProjectIds, id])],
          };
        });
        return true;
      } catch {
        return false;
      }
    },

    relockProject: async (id) => {
      if (!projectPins.has(id)) return;
      const { activeNoteId, notes, revealedId } = get();
      const active = notes.find((n) => n.id === activeNoteId);
      // A revealed locked note inside is secured first.
      if (revealedId && notes.find((n) => n.id === revealedId)?.projectId === id) {
        await flushAndHide();
      }
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = undefined;
      }
      await persistNow(); // seals the project with its current notes
      projectPins.delete(id);
      set((state) => ({
        notes: state.notes.filter((n) => n.projectId !== id),
        unlockedProjectIds: state.unlockedProjectIds.filter((x) => x !== id),
        activeNoteId: active?.projectId === id ? undefined : state.activeNoteId,
      }));
    },

    relockAllProjects: async () => {
      for (const id of [...projectPins.keys()]) {
        await get().relockProject(id);
      }
    },

    removeProjectLock: (id) => {
      if (!projectPins.has(id)) return;
      projectPins.delete(id);
      set((state) => ({
        projects: state.projects.map((p) => {
          if (p.id !== id) return p;
          const { sealed: _drop, ...plain } = p;
          void _drop;
          return { ...plain, locked: false, updatedAt: Date.now() };
        }),
        unlockedProjectIds: state.unlockedProjectIds.filter((x) => x !== id),
      }));
      saveProjects();
    },

    moveNote: (noteId, projectId) => {
      // A closed locked project can't take new notes (its PIN is needed to seal them).
      if (isClosedLocked(projectId ?? undefined)) return;
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
      saveProjects();
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

    focusBlock: (id, at = "end") => set({ focusBlockId: id, focusAt: at }),

    consumeFocus: () => set({ focusBlockId: undefined, focusAt: undefined }),
  };
});
