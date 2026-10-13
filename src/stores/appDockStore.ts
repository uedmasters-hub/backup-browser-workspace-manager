import { create } from "zustand";

import type { DockApp, DockTab } from "../browser/services/appDockRanking";
import {
  getOpenDockTabs,
  collectHiResIcons,
  getTopApps,
  rememberAppIcons,
} from "../browser/services/appDockService";
import {
  getAppDockEnabled,
  getAppDockHidden,
  setAppDockEnabled,
  setAppDockHidden,
} from "../browser/storage/preferencesRepository";

interface AppDockStore {
  enabled: boolean;
  hidden: string[];
  apps: DockApp[];
  openTabs: DockTab[];
  icons: Record<string, string>;
  /** Sharp icon per app ("" = looked, none found). */
  hiResIcons: Record<string, string>;
  loaded: boolean;
  load: () => Promise<void>;
  /** Re-read open tabs (cheap) — keeps open-state dots and icons live. */
  refreshOpen: () => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
  hide: (key: string) => Promise<void>;
  restoreHidden: () => Promise<void>;
}

export const useAppDockStore = create<AppDockStore>((set, get) => ({
  enabled: true,
  hidden: [],
  apps: [],
  openTabs: [],
  icons: {},
  hiResIcons: {},
  loaded: false,

  load: async () => {
    const [enabled, hidden, openTabs] = await Promise.all([
      getAppDockEnabled(),
      getAppDockHidden(),
      getOpenDockTabs(),
    ]);
    set({ enabled, hidden, openTabs });
    const [apps, icons] = await Promise.all([
      getTopApps(openTabs, hidden),
      rememberAppIcons(openTabs),
    ]);
    set({ apps, icons, loaded: true });
    const hiResIcons = await collectHiResIcons(apps.map((a) => a.key), openTabs);
    set({ hiResIcons });
  },

  refreshOpen: async () => {
    const openTabs = await getOpenDockTabs();
    const icons = await rememberAppIcons(openTabs);
    set({ openTabs, icons });
  },

  setEnabled: async (enabled) => {
    set({ enabled });
    await setAppDockEnabled(enabled);
  },

  hide: async (key) => {
    const hidden = [...new Set([...get().hidden, key])];
    set({ hidden, apps: get().apps.filter((a) => a.key !== key) });
    await setAppDockHidden(hidden);
  },

  restoreHidden: async () => {
    set({ hidden: [] });
    await setAppDockHidden([]);
    await get().load();
  },
}));
