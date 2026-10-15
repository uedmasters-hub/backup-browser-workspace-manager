/**
 * Auto Group Tabs — the popup's side. The background worker does all the
 * indexing and grouping (src/browser/background/autoGroup.ts); the popup asks
 * it for a review, to apply, or to undo, and listens to its progress. Keeps
 * the categoriser (and its public-suffix data) out of the popup bundle.
 */
import { STORAGE_KEYS } from "../../constants/storageKeys";
import type { TabGroupColor } from "../../types/tab";

export const AUTO_GROUP_MESSAGE = "bwm:auto-group";
export const AUTO_GROUP_PROGRESS = "bwm:auto-group-progress";

/** "on" = keep tabs grouped; "off" = leave tabs alone; undefined = never set up. */
export type AutoGroupMode = "on" | "off";

export type AutoGroupRequest =
  | { type: typeof AUTO_GROUP_MESSAGE; action: "status" }
  | { type: typeof AUTO_GROUP_MESSAGE; action: "preview" }
  | { type: typeof AUTO_GROUP_MESSAGE; action: "apply"; exclude: string[]; include: string[] }
  | { type: typeof AUTO_GROUP_MESSAGE; action: "undo" }
  | { type: typeof AUTO_GROUP_MESSAGE; action: "setMode"; mode: AutoGroupMode };

/** Indexing = reading and categorising tabs; grouping = moving them. */
export interface AutoGroupProgress {
  phase: "indexing" | "grouping";
  done: number;
  total: number;
}

export interface AutoGroupProgressMessage {
  type: typeof AUTO_GROUP_PROGRESS;
  /** null = finished. */
  progress: AutoGroupProgress | null;
}

export interface PreviewTab {
  id: number;
  title: string;
  favicon?: string;
}

export interface PreviewGroup {
  key: string;
  name: string;
  emoji?: string;
  color: TabGroupColor;
  count: number;
  /** Its tabs, newest first (up to 40). */
  tabs: PreviewTab[];
  /** True when the tabs join a group you already have. */
  joinsExisting: boolean;
  /** You turned this group off before — unchecked in the review. */
  excluded: boolean;
}

export interface AutoGroupPreview {
  groups: PreviewGroup[];
  tabCount: number;
  /** Tabs read and categorised. */
  indexed: number;
  keptInGroups: number;
}

export interface ApplyResult {
  tabCount: number;
  groupCount: number;
  /** Why some groups couldn't be made (a tab closed, the browser refused…). */
  errors: string[];
}

export interface AutoGroupStatus {
  mode: AutoGroupMode | undefined;
  progress: AutoGroupProgress | null;
  /** The last "Group tabs" can still be undone. */
  canUndo: boolean;
  lastResult: ApplyResult | null;
}

type RequestBody = AutoGroupRequest extends infer R ? (R extends AutoGroupRequest ? Omit<R, "type"> : never) : never;

export class AutoGroupError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ask the background worker. It may be asleep or starting — a missing
 * receiver is retried a few times before giving up with a clear error.
 */
async function ask<T>(request: RequestBody): Promise<T> {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
    throw new AutoGroupError("Not running as an extension.");
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = (await chrome.runtime.sendMessage({ type: AUTO_GROUP_MESSAGE, ...request })) as
        | { ok: true; data: T }
        | { ok: false; error: string }
        | undefined;
      if (res === undefined) throw new AutoGroupError("The background service didn't answer.");
      if (!res.ok) throw new AutoGroupError(res.error);
      return res.data;
    } catch (error) {
      lastError = error;
      const message = String((error as Error)?.message ?? error);
      // Waking up: "Receiving end does not exist" / no answer — try again shortly.
      if (!/receiving end|didn't answer|could not establish/i.test(message)) break;
      await sleep(250 * (attempt + 1));
    }
  }
  console.warn("[autoGroup]", lastError);
  throw lastError instanceof AutoGroupError
    ? lastError
    : new AutoGroupError(
        /receiving end|could not establish/i.test(String((lastError as Error)?.message))
          ? "The background service isn't running. Reload the extension and try again."
          : String((lastError as Error)?.message ?? lastError)
      );
}

export function isAutoGroupSupported(): boolean {
  return typeof chrome !== "undefined" && Boolean(chrome.tabGroups?.query);
}

export async function getAutoGroupMode(): Promise<AutoGroupMode | undefined> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.AUTO_GROUP_MODE);
  const mode = result[STORAGE_KEYS.AUTO_GROUP_MODE];
  return mode === "on" || mode === "off" ? mode : undefined;
}

export const getAutoGroupStatus = () => ask<AutoGroupStatus>({ action: "status" });

/** Index every open tab and suggest groups — nothing moves. */
export const previewAutoGroups = () => ask<AutoGroupPreview>({ action: "preview" });

/** Group loose tabs (minus the groups the user unchecked) and turn auto-grouping on. */
export const applyAutoGroups = (include: string[], exclude: string[]) =>
  ask<ApplyResult>({ action: "apply", include, exclude });

/** Put the tabs from the last "Group tabs" back where they were; auto-grouping turns off. */
export const undoAutoGroups = () => ask<boolean>({ action: "undo" });

export const setAutoGroupMode = (mode: AutoGroupMode) => ask<boolean>({ action: "setMode", mode });

/** Progress from the background (indexing, grouping — including automatic grouping of new tabs). */
export function onAutoGroupProgress(listener: (progress: AutoGroupProgress | null) => void): () => void {
  if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) return () => undefined;
  const handler = (message: unknown) => {
    const m = message as AutoGroupProgressMessage | undefined;
    if (m?.type === AUTO_GROUP_PROGRESS) listener(m.progress);
    return false;
  };
  chrome.runtime.onMessage.addListener(handler);
  return () => chrome.runtime.onMessage.removeListener(handler);
}
