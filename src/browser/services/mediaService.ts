/**
 * Media control for a tab's <video>/<audio>, via chrome.scripting.
 * Requires the "scripting" permission and host access. Each call injects a
 * tiny function into the page; we pick a stable "primary" media element
 * (the one with the longest finite duration) so reads and controls agree.
 */

export interface MediaState {
  hasMedia: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  /** Frame the primary media element lives in (for follow-up control). */
  frameId: number;
}

// Runs inside the page. Must be self-contained (no outer references).
function readMediaInFrame(): {
  hasMedia: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
} {
  const els = Array.from(
    document.querySelectorAll("video, audio")
  ) as HTMLMediaElement[];
  if (els.length === 0) {
    return { hasMedia: false, playing: false, currentTime: 0, duration: 0 };
  }
  // Score: strongly prefer a currently-playing element, then the longest one.
  const score = (e: HTMLMediaElement) => {
    const dur = Number.isFinite(e.duration) && e.duration > 0 ? e.duration : 0;
    const live = !e.paused && !e.ended && e.readyState > 2 ? 1 : 0;
    return live * 1e7 + dur;
  };
  const pick = els.slice().sort((a, b) => score(b) - score(a))[0];
  return {
    hasMedia: true,
    playing: !pick.paused && !pick.ended,
    currentTime: pick.currentTime || 0,
    duration: Number.isFinite(pick.duration) ? pick.duration : 0,
  };
}

function controlMediaInFrame(action: {
  kind: "toggle" | "play" | "pause" | "seek";
  time?: number;
}): void {
  const els = Array.from(
    document.querySelectorAll("video, audio")
  ) as HTMLMediaElement[];
  if (els.length === 0) {
    return;
  }
  const score = (e: HTMLMediaElement) => {
    const dur = Number.isFinite(e.duration) && e.duration > 0 ? e.duration : 0;
    const live = !e.paused && !e.ended && e.readyState > 2 ? 1 : 0;
    return live * 1e7 + dur;
  };
  const pick = els.slice().sort((a, b) => score(b) - score(a))[0];

  if (action.kind === "seek" && typeof action.time === "number") {
    pick.currentTime = action.time;
    return;
  }
  const shouldPlay =
    action.kind === "play" ||
    (action.kind === "toggle" && pick.paused);
  if (shouldPlay) {
    void pick.play().catch(() => undefined);
  } else {
    pick.pause();
  }
}

const EMPTY: MediaState = {
  hasMedia: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  frameId: 0,
};

/** Read media state across all frames; return the best (longest) one. */
export async function getMediaState(tabId: number): Promise<MediaState> {
  if (!chrome.scripting?.executeScript) {
    return EMPTY;
  }
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: readMediaInFrame,
    });

    let best: MediaState | null = null;
    for (const r of results) {
      const v = r.result as {
        hasMedia: boolean;
        playing: boolean;
        currentTime: number;
        duration: number;
      } | null;
      if (!v?.hasMedia) {
        continue;
      }
      const candidate: MediaState = { ...v, frameId: r.frameId ?? 0 };
      if (
        !best ||
        candidate.duration > best.duration ||
        (candidate.playing && !best.playing)
      ) {
        best = candidate;
      }
    }
    return best ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

async function control(
  tabId: number,
  frameId: number,
  action: { kind: "toggle" | "play" | "pause" | "seek"; time?: number }
): Promise<void> {
  if (!chrome.scripting?.executeScript) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: controlMediaInFrame,
      args: [action],
    });
  } catch {
    // Frame gone or not scriptable; ignore.
  }
}

export function toggleMediaPlayback(
  tabId: number,
  frameId: number
): Promise<void> {
  return control(tabId, frameId, { kind: "toggle" });
}

export function seekMedia(
  tabId: number,
  frameId: number,
  time: number
): Promise<void> {
  return control(tabId, frameId, { kind: "seek", time });
}
