import { useEffect } from "react";
import type { RefObject } from "react";

import { TAB_PREVIEW } from "../../../constants/tabPreview";
import { usePreviewStore } from "../../../stores/previewStore";

/**
 * Hover intent shared by every tab row:
 * - first preview waits `openDelayMs`, so passing the pointer over the list
 *   doesn't flash cards;
 * - once one is open (or was open a moment ago), the next row switches fast;
 * - scrolling, clicking or pressing a key closes it, and it stays closed until
 *   the pointer actually moves again (rows sliding under a still pointer while
 *   scrolling never trigger a preview).
 */
let openTimer: number | undefined;
let closeTimer: number | undefined;
/** Row whose open timer is running, so repeated pointer moves don't restart it. */
let pendingTabId: number | null = null;
let lastClosedAt = 0;
let suppressed = false;
let listening = false;

function closeNow() {
  pendingTabId = null;
  window.clearTimeout(openTimer);
  window.clearTimeout(closeTimer);
  if (usePreviewStore.getState().tabId !== null) {
    lastClosedAt = Date.now();
    usePreviewStore.getState().hide();
  }
}

function listenOnce() {
  if (listening) return;
  listening = true;
  const dismiss = () => {
    suppressed = true;
    closeNow();
  };
  window.addEventListener("scroll", dismiss, true);
  window.addEventListener("wheel", dismiss, { passive: true });
  window.addEventListener("pointerdown", dismiss, true);
  window.addEventListener("keydown", dismiss, true);
  window.addEventListener("blur", dismiss);
  // Capture phase: runs before the row's own handler on the same move.
  window.addEventListener(
    "pointermove",
    () => {
      suppressed = false;
    },
    { passive: true, capture: true }
  );
}

export function useTabPreviewTrigger(
  tabId: number,
  ref: RefObject<HTMLElement | null>,
  disabled: boolean
) {
  useEffect(() => {
    if (TAB_PREVIEW.enabled) listenOnce();
  }, []);

  // Close if this row's preview is open and the row goes away or is disabled.
  useEffect(() => {
    if (!disabled) return;
    if (usePreviewStore.getState().tabId === tabId) closeNow();
  }, [disabled, tabId]);

  useEffect(
    () => () => {
      if (usePreviewStore.getState().tabId === tabId) closeNow();
    },
    [tabId]
  );

  // Armed on pointer *movement* over the row (not just enter), so a row the
  // pointer is already resting on still previews once the pointer moves again.
  function onMouseMove() {
    if (!TAB_PREVIEW.enabled || disabled || suppressed) return;
    window.clearTimeout(closeTimer);
    if (pendingTabId === tabId || usePreviewStore.getState().tabId === tabId) {
      return;
    }
    window.clearTimeout(openTimer);
    pendingTabId = tabId;

    const warm =
      usePreviewStore.getState().tabId !== null ||
      Date.now() - lastClosedAt < 400;

    openTimer = window.setTimeout(() => {
      pendingTabId = null;
      const el = ref.current;
      if (!el || suppressed) return;
      const r = el.getBoundingClientRect();
      usePreviewStore.getState().show(tabId, {
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        width: r.width,
      });
    }, warm ? TAB_PREVIEW.switchDelayMs : TAB_PREVIEW.openDelayMs);
  }

  function onMouseLeave() {
    if (pendingTabId === tabId) pendingTabId = null;
    window.clearTimeout(openTimer);
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(closeNow, TAB_PREVIEW.closeDelayMs);
  }

  return { onMouseMove, onMouseLeave };
}
