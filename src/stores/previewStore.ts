import { create } from "zustand";

export interface PreviewAnchor {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

interface PreviewStore {
  tabId: number | null;
  anchor: PreviewAnchor | null;
  show: (tabId: number, anchor: PreviewAnchor) => void;
  hide: () => void;
}

/** Which tab row's hover preview is open, and where that row sits. */
export const usePreviewStore = create<PreviewStore>((set) => ({
  tabId: null,
  anchor: null,
  show: (tabId, anchor) => set({ tabId, anchor }),
  hide: () => set({ tabId: null, anchor: null }),
}));
