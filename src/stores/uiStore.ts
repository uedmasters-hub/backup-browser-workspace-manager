import { create } from "zustand";

export type ViewMode =
  | "grid"
  | "list";

export type DialogType =
  | "rename-workspace"
  | "move-tabs"
  | "group-tabs"
  | "color-picker"
  | "emoji-picker"
  | null;

interface UIState {
  searchQuery: string;

  viewMode: ViewMode;

  loading: boolean;

  activeDialog: DialogType;

  activeWorkspaceId:
    | number
    | null;

  activeWorkspaceMenu:
    | number
    | null;

  notesOpen: boolean;
}

interface UIActions {
  setSearchQuery: (
    query: string
  ) => void;

  setViewMode: (
    mode: ViewMode
  ) => void;

  setLoading: (
    loading: boolean
  ) => void;

  openDialog: (
    dialog: DialogType,
    workspaceId?: number
  ) => void;

  closeDialog: () => void;

  openColorPicker: (
    chromeWindowId: number
  ) => void;

  openEmojiPicker: (
    chromeWindowId: number
  ) => void;

  closeColorPicker: () => void;

  closeEmojiPicker: () => void;

  openWorkspaceMenu: (
    chromeWindowId: number
  ) => void;

  closeWorkspaceMenu: () => void;

  toggleNotes: () => void;

  openNotes: () => void;

  closeNotes: () => void;
}

type UIStore =
  UIState &
  UIActions;

export const useUIStore =
  create<UIStore>((set) => ({
    searchQuery: "",

    viewMode: "grid",

    loading: false,

    activeDialog: null,

    activeWorkspaceId: null,

    activeWorkspaceMenu: null,

    notesOpen: false,

    setSearchQuery: (query) =>
      set({
        searchQuery: query,
      }),

    setViewMode: (mode) =>
      set({
        viewMode: mode,
      }),

    setLoading: (loading) =>
      set({
        loading,
      }),

    openDialog: (
      dialog,
      workspaceId
    ) =>
      set({
        activeDialog: dialog,
        activeWorkspaceId:
          workspaceId ??
          null,
      }),

    closeDialog: () =>
      set({
        activeDialog: null,
        activeWorkspaceId:
          null,
      }),

    openColorPicker: (
      chromeWindowId
    ) =>
      set({
        activeDialog:
          "color-picker",
        activeWorkspaceId:
          chromeWindowId,
      }),

    closeColorPicker: () =>
      set({
        activeDialog: null,
        activeWorkspaceId:
          null,
      }),

    openEmojiPicker: (
      chromeWindowId
    ) =>
      set({
        activeDialog:
          "emoji-picker",
        activeWorkspaceId:
          chromeWindowId,
      }),

    closeEmojiPicker: () =>
      set({
        activeDialog: null,
        activeWorkspaceId:
          null,
      }),

    openWorkspaceMenu: (
      chromeWindowId
    ) =>
      set({
        activeWorkspaceMenu:
          chromeWindowId,
      }),

    closeWorkspaceMenu: () =>
      set({
        activeWorkspaceMenu:
          null,
      }),

    toggleNotes: () =>
      set((state) => ({
        notesOpen: !state.notesOpen,
      })),

    openNotes: () =>
      set({ notesOpen: true }),

    closeNotes: () =>
      set({ notesOpen: false }),
  }));
