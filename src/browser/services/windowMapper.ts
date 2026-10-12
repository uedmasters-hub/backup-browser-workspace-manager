import {
  PRIVATE_WINDOW_COLOR,
  WINDOW_COLORS,
} from "../../constants/windowColors";
import { PRIVATE_LABEL } from "./incognitoService";

import type { WorkspaceWindow } from "../../types/window";
import type { WorkspaceMetadata } from "../../types/workspace";

/**
 * `index` counts windows of the same kind — normal and private windows are
 * numbered separately, so opening a private window never renumbers the rest.
 */
export function mapChromeWindow(
  chromeWindow: chrome.windows.Window,
  index: number,
  metadata?: WorkspaceMetadata
): WorkspaceWindow {
  const now = new Date().toISOString();
  const incognito = chromeWindow.incognito;

  return {
    id: chromeWindow.id ?? 0,

    chromeWindowId: chromeWindow.id,

    name:
      metadata?.name ??
      (incognito
        ? `${PRIVATE_LABEL.window} ${index + 1}`
        : `Window ${index + 1}`),

    color:
      metadata?.color ??
      (incognito
        ? PRIVATE_WINDOW_COLOR
        : WINDOW_COLORS[index % WINDOW_COLORS.length]),

    emoji: metadata?.emoji,

    tabCount: chromeWindow.tabs?.length ?? 0,

    isActive: chromeWindow.focused ?? false,

    isArchived:
      metadata?.archived ?? false,

    createdAt:
      metadata?.createdAt ?? now,

    updatedAt:
      metadata?.updatedAt ?? now,

    coverImage: undefined,

    incognito,
  };
}
