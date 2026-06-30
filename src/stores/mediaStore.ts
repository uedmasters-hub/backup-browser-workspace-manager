import { create } from "zustand";

import {
  getMediaState,
  seekMedia,
  toggleMediaPlayback,
  type MediaState,
} from "../browser/services/mediaService";

interface MediaStore {
  byTab: Record<number, MediaState>;
  /** Tab ids the user is actively scrubbing — skip polled overwrites. */
  dragging: Record<number, boolean>;

  refresh: (tabIds: number[]) => Promise<void>;
  toggle: (tabId: number) => Promise<void>;
  seek: (tabId: number, time: number) => Promise<void>;
  setDragging: (tabId: number, value: boolean) => void;
  previewSeek: (tabId: number, time: number) => void;
}

export const useMediaStore = create<MediaStore>((set, get) => ({
  byTab: {},
  dragging: {},

  refresh: async (tabIds) => {
    const results = await Promise.all(
      tabIds.map(async (id) => [id, await getMediaState(id)] as const)
    );
    set((state) => {
      const byTab = { ...state.byTab };
      for (const [id, media] of results) {
        // Don't clobber the thumb position while the user is dragging.
        if (state.dragging[id]) {
          byTab[id] = { ...media, currentTime: byTab[id]?.currentTime ?? 0 };
        } else {
          byTab[id] = media;
        }
      }
      return { byTab };
    });
  },

  toggle: async (tabId) => {
    const media = get().byTab[tabId];
    if (!media?.hasMedia) {
      return;
    }
    // Optimistic flip for instant feedback.
    set((state) => ({
      byTab: {
        ...state.byTab,
        [tabId]: { ...media, playing: !media.playing },
      },
    }));
    await toggleMediaPlayback(tabId, media.frameId);
  },

  seek: async (tabId, time) => {
    const media = get().byTab[tabId];
    if (!media?.hasMedia) {
      return;
    }
    set((state) => ({
      byTab: { ...state.byTab, [tabId]: { ...media, currentTime: time } },
    }));
    await seekMedia(tabId, media.frameId, time);
  },

  setDragging: (tabId, value) =>
    set((state) => ({
      dragging: { ...state.dragging, [tabId]: value },
    })),

  previewSeek: (tabId, time) =>
    set((state) => {
      const media = state.byTab[tabId];
      if (!media) {
        return state;
      }
      return {
        byTab: { ...state.byTab, [tabId]: { ...media, currentTime: time } },
      };
    }),
}));
