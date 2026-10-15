/**
 * Auto Group Tabs — the popup's side. The background worker does all the
 * grouping (src/browser/background/autoGroup.ts), so the popup only asks it
 * for a preview, to apply, or to undo. Keeps the categoriser (and its
 * public-suffix data) out of the popup bundle.
 */
import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { TabGroupColor } from "../../types/tab";

export const AUTO_GROUP_MESSAGE = "bwm:auto-group";

/** "on" = keep tabs grouped; "off" = leave tabs alone; undefined = not asked yet. */
export type AutoGroupMode = "on" | "off";

export type AutoGroupRequest =
  | { type: typeof AUTO_GROUP_MESSAGE; action: "preview" }
  | { type: typeof AUTO_GROUP_MESSAGE; action: "apply" }
  | { type: typeof AUTO_GROUP_MESSAGE; action: "undo" }
  | { type: typeof AUTO_GROUP_MESSAGE; action: "setMode"; mode: AutoGroupMode };

export interface PreviewGroup {
  key: string;
  name: string;
  emoji?: string;
  color: TabGroupColor;
  count: number;
  /** A few of its tabs, newest first. */
  favicons: string[];
  titles: string[];
  /** True when tabs join a group you already have. */
  joinsExisting: boolean;
}

export interface AutoGroupPreview {
  groups: PreviewGroup[];
  tabCount: number;
  keptInGroups: number;
}

export interface ApplyResult {
  tabCount: number;
  groupCount: number;
}

type RequestBody = AutoGroupRequest extends infer R ? (R extends AutoGroupRequest ? Omit<R, "type"> : never) : never;

async function ask<T>(request: RequestBody): Promise<T | null> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  try {
    const res = (await chrome.runtime.sendMessage({ type: AUTO_GROUP_MESSAGE, ...request })) as
      | { ok: true; data: T }
      | { ok: false; error: string }
      | undefined;
    if (!res) return null;
    if (!res.ok) {
      console.warn("[autoGroup]", res.error);
      return null;
    }
    return res.data;
  } catch (error) {
    console.warn("[autoGroup] background unavailable", error);
    return null;
  }
}

export function isAutoGroupSupported(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.tabGroups?.query);
}

export async function getAutoGroupMode(): Promise<AutoGroupMode | undefined> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.AUTO_GROUP_MODE);
  const mode = result[STORAGE_KEYS.AUTO_GROUP_MODE];
  return mode === "on" || mode === "off" ? mode : undefined;
}

export const previewAutoGroups = () => ask<AutoGroupPreview>({ action: "preview" });

/** Groups every loose tab and turns auto-grouping on. */
export const applyAutoGroups = () => ask<ApplyResult>({ action: "apply" });

/** Puts the tabs from the last "Group tabs" back where they were, and turns auto-grouping off. */
export const undoAutoGroups = () => ask<boolean>({ action: "undo" });

export const setAutoGroupMode = (mode: AutoGroupMode) => ask<boolean>({ action: "setMode", mode });
