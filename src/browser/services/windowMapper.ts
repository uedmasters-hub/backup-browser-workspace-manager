import { WINDOW_COLORS } from "../../constants/windowColors";

import type { WorkspaceWindow } from "../../types/window";
import type { WorkspaceMetadata } from "../../types/workspace";

export function mapChromeWindow(
  chromeWindow: chrome.windows.Window,
  index: number,
  metadata?: WorkspaceMetadata
): WorkspaceWindow {
  const now = new Date().toISOString();

  return {
    id: chromeWindow.id ?? 0,

    chromeWindowId: chromeWindow.id,

    name:
      metadata?.name ??
      `Window ${index + 1}`,

    color:
      metadata?.color ??
      WINDOW_COLORS[
        index % WINDOW_COLORS.length
      ],

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
  };
}
