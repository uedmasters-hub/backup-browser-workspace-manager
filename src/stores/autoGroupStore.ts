import { create } from "zustand";

import {
  applyAutoGroups,
  getAutoGroupMode,
  getAutoGroupStatus,
  isAutoGroupSupported,
  onAutoGroupProgress,
  previewAutoGroups,
  setAutoGroupMode,
  undoAutoGroups,
  type ApplyResult,
  type AutoGroupMode,
  type AutoGroupPreview,
  type AutoGroupProgress,
} from "../browser/services/autoGroupService";
import { useTabStore } from "./tabStore";
import { useWindowStore } from "./windowStore";

/**
 * The header's Auto Group control.
 *
 *   status ──scan──▶ scanning ──▶ review ──Group tabs──▶ applying ──▶ result
 *                                   │                                   │
 *                                   └──Not now──▶ status        Undo ◀──┘
 *
 * First time (never set up), opening the panel starts the scan right away.
 * Once on, new tabs are grouped by the background worker; its progress shows
 * here too (icon spins, bar under the header).
 */
export type AutoGroupView = "status" | "scanning" | "review" | "applying" | "result" | "error";

/** Keep the progress bar up long enough to be seen. */
const MIN_PROGRESS_MS = 600;

interface AutoGroupStore {
  supported: boolean;
  /** undefined = never set up. */
  mode: AutoGroupMode | undefined;
  loaded: boolean;
  panelOpen: boolean;
  view: AutoGroupView;
  preview: AutoGroupPreview | null;
  /** Group keys checked in the review. */
  selected: string[];
  /** Indexing / grouping in progress (from the background). */
  progress: AutoGroupProgress | null;
  /** A request from this popup is running (scan, apply, undo…). */
  working: boolean;
  result: ApplyResult | null;
  canUndo: boolean;
  error: string | null;

  init: () => () => void;
  openPanel: () => void;
  closePanel: () => void;
  scan: () => Promise<void>;
  toggleGroup: (key: string) => void;
  apply: () => Promise<void>;
  notNow: () => Promise<void>;
  turnOn: () => Promise<void>;
  turnOff: () => Promise<void>;
  undo: () => Promise<void>;
}

async function refreshLists() {
  await Promise.all([
    useTabStore.getState().reloadTabs(),
    useWindowStore.getState().refreshWindows(),
  ]);
}

let progressShownAt = 0;
let progressTimer: ReturnType<typeof setTimeout> | undefined;

const message = (error: unknown) => String((error as Error)?.message ?? error);

export const useAutoGroupStore = create<AutoGroupStore>((set, get) => {
  /** Progress from the background, held on screen for at least MIN_PROGRESS_MS. */
  function showProgress(next: AutoGroupProgress | null) {
    clearTimeout(progressTimer);
    if (next) {
      if (!get().progress) progressShownAt = Date.now();
      set({ progress: next });
      return;
    }
    const wait = Math.max(0, progressShownAt + MIN_PROGRESS_MS - Date.now());
    progressTimer = setTimeout(() => set({ progress: null }), wait);
  }

  async function run<T>(view: AutoGroupView, job: () => Promise<T>): Promise<T | undefined> {
    set({ view, working: true, error: null });
    try {
      return await job();
    } catch (error) {
      set({ view: "error", error: message(error) });
      return undefined;
    } finally {
      set({ working: false });
      showProgress(null);
    }
  }

  return {
    supported: isAutoGroupSupported(),
    mode: undefined,
    loaded: false,
    panelOpen: false,
    view: "status",
    preview: null,
    selected: [],
    progress: null,
    working: false,
    result: null,
    canUndo: false,
    error: null,

    init: () => {
      if (!get().supported) return () => undefined;
      const stop = onAutoGroupProgress((p) => showProgress(p));
      void getAutoGroupMode().then((mode) => set({ mode, loaded: true }));
      // Anything already running, and whether the last grouping can be undone.
      void getAutoGroupStatus()
        .then((s) => {
          set({ mode: s.mode, canUndo: s.canUndo, result: s.canUndo ? s.lastResult : null });
          if (s.progress) showProgress(s.progress);
        })
        .catch(() => undefined);
      return stop;
    },

    openPanel: () => {
      set({ panelOpen: true });
      const { mode, view, working } = get();
      if (working) return;
      // First time (or turned off): index tabs straight away and suggest groups.
      if (mode !== "on" && (view === "status" || view === "error" || view === "result")) void get().scan();
    },

    closePanel: () => {
      set({ panelOpen: false });
      // Finished screens reset; a review in progress is kept for next time.
      const { view, working } = get();
      if (!working && (view === "result" || view === "error")) set({ view: "status", error: null });
    },

    scan: async () => {
      const preview = await run("scanning", previewAutoGroups);
      if (!preview) return;
      set({
        preview,
        view: "review",
        selected: preview.groups.filter((g) => !g.excluded).map((g) => g.key),
      });
    },

    toggleGroup: (key) =>
      set((s) => ({
        selected: s.selected.includes(key) ? s.selected.filter((k) => k !== key) : [...s.selected, key],
      })),

    apply: async () => {
      const { preview, selected } = get();
      const keys = preview?.groups.map((g) => g.key) ?? [];
      const include = keys.filter((k) => selected.includes(k));
      const exclude = keys.filter((k) => !selected.includes(k));
      const result = await run("applying", () => applyAutoGroups(include, exclude));
      if (!result) return;
      set({ mode: "on", result, canUndo: result.tabCount > 0, preview: null });
      if (result.tabCount === 0 && result.errors.length > 0) {
        set({ view: "error", error: result.errors[0] });
      } else {
        set({ view: "result" });
      }
      await refreshLists();
    },

    notNow: async () => {
      set({ view: "status", preview: null, panelOpen: false });
      // First time: remember the choice so the icon stops asking.
      if (get().mode === undefined) {
        set({ mode: "off" });
        await setAutoGroupMode("off").catch(() => undefined);
      }
    },

    /** Nothing to review (tabs already tidy) — just keep new tabs grouped. */
    turnOn: async () => {
      const ok = await run("applying", () => setAutoGroupMode("on"));
      if (ok === undefined) return;
      set({ mode: "on", view: "status", preview: null });
      await refreshLists();
    },

    turnOff: async () => {
      const ok = await run("status", () => setAutoGroupMode("off"));
      if (ok === undefined) return;
      set({ mode: "off", view: "status" });
    },

    undo: async () => {
      const ok = await run("applying", undoAutoGroups);
      if (ok === undefined) return;
      set({ mode: "off", view: "status", result: null, canUndo: false });
      await refreshLists();
    },
  };
});
