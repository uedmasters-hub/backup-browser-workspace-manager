import { create } from "zustand";

import {
  applyAutoGroups,
  getAutoGroupMode,
  isAutoGroupSupported,
  previewAutoGroups,
  setAutoGroupMode,
  undoAutoGroups,
  type ApplyResult,
  type AutoGroupMode,
  type AutoGroupPreview,
} from "../browser/services/autoGroupService";
import { useTabStore } from "./tabStore";
import { useWindowStore } from "./windowStore";

interface AutoGroupStore {
  supported: boolean;
  /** undefined = the user hasn't chosen yet (the suggestion shows). */
  mode: AutoGroupMode | undefined;
  loaded: boolean;
  preview: AutoGroupPreview | null;
  busy: null | "apply" | "undo";
  /** Last "Group tabs" — shown with Undo. */
  result: ApplyResult | null;
  /** Just undone — a short note. */
  undone: boolean;

  load: () => Promise<void>;
  apply: () => Promise<void>;
  skip: () => Promise<void>;
  undo: () => Promise<void>;
  setEnabled: (on: boolean) => Promise<void>;
  dismiss: () => void;
}

async function refreshLists() {
  await Promise.all([
    useTabStore.getState().reloadTabs(),
    useWindowStore.getState().refreshWindows(),
  ]);
}

export const useAutoGroupStore = create<AutoGroupStore>((set, get) => ({
  supported: isAutoGroupSupported(),
  mode: undefined,
  loaded: false,
  preview: null,
  busy: null,
  result: null,
  undone: false,

  load: async () => {
    if (!get().supported) return;
    const mode = await getAutoGroupMode();
    set({ mode, loaded: true });
    // Index and categorise open tabs only until the user decides.
    if (mode === undefined) {
      const preview = await previewAutoGroups();
      if (get().mode === undefined) set({ preview });
    }
  },

  apply: async () => {
    if (get().busy) return;
    set({ busy: "apply", undone: false });
    const result = await applyAutoGroups();
    set({ busy: null, mode: "on", preview: null, result: result ?? { tabCount: 0, groupCount: 0 } });
    await refreshLists();
  },

  skip: async () => {
    set({ mode: "off", preview: null });
    await setAutoGroupMode("off");
  },

  undo: async () => {
    if (get().busy) return;
    set({ busy: "undo" });
    await undoAutoGroups();
    set({ busy: null, mode: "off", result: null, undone: true });
    await refreshLists();
  },

  setEnabled: async (on) => {
    if (on) {
      await get().apply();
      return;
    }
    set({ mode: "off", preview: null, result: null, undone: false });
    await setAutoGroupMode("off");
  },

  dismiss: () => set({ result: null, undone: false }),
}));
