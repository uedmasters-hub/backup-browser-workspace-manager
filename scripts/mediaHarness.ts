/* Media store harness: mocks chrome.scripting to validate refresh/toggle/seek. */

interface PageMedia {
  hasMedia: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
}

const PAGE: PageMedia = {
  hasMedia: true,
  playing: false,
  currentTime: 10,
  duration: 100,
};

// Per-tab page state for multi-media independence checks.
const PAGES: Record<number, PageMedia> = {
  10: { hasMedia: true, playing: true, currentTime: 5, duration: 200 },
  20: { hasMedia: true, playing: false, currentTime: 80, duration: 300 },
};

let lastControlFrame: number | undefined;

(globalThis as unknown as { chrome: unknown }).chrome = {
  scripting: {
    executeScript: async (opts: {
      target: { tabId: number; allFrames?: boolean; frameIds?: number[] };
      func: unknown;
      args?: { kind: string; time?: number }[];
    }) => {
      const page = PAGES[opts.target.tabId] ?? PAGE;
      if (opts.target.allFrames) {
        return [
          {
            frameId: 3,
            result: page.hasMedia
              ? {
                  hasMedia: true,
                  playing: page.playing,
                  currentTime: page.currentTime,
                  duration: page.duration,
                }
              : { hasMedia: false, playing: false, currentTime: 0, duration: 0 },
          },
        ];
      }
      lastControlFrame = opts.target.frameIds?.[0];
      const action = opts.args?.[0];
      if (action?.kind === "seek" && typeof action.time === "number") {
        page.currentTime = action.time;
      } else if (action?.kind === "toggle") {
        page.playing = !page.playing;
      }
      return [];
    },
  },
};

const { useMediaStore } = await import("../src/stores/mediaStore");

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail = "") {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`  \u2717 ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const M = () => useMediaStore.getState();

// refresh reads page state into byTab
await M().refresh([1]);
check("refresh records hasMedia", M().byTab[1]?.hasMedia === true);
check("refresh records duration", M().byTab[1]?.duration === 100);
check("refresh records frameId", M().byTab[1]?.frameId === 3);
check("refresh records currentTime", M().byTab[1]?.currentTime === 10);

// toggle flips optimistically + drives the page
await M().toggle(1);
check("toggle optimistic playing flip", M().byTab[1]?.playing === true);
check("toggle controls the chosen frame", lastControlFrame === 3);
check("toggle reaches the page", PAGE.playing === true);

// seek updates store + page
await M().seek(1, 42);
check("seek updates store currentTime", M().byTab[1]?.currentTime === 42);
check("seek reaches the page", PAGE.currentTime === 42);

// while dragging, polled currentTime is not clobbered
M().setDragging(1, true);
PAGE.currentTime = 99;
await M().refresh([1]);
check(
  "dragging preserves local currentTime",
  M().byTab[1]?.currentTime === 42,
  `got ${M().byTab[1]?.currentTime}`
);
M().setDragging(1, false);
await M().refresh([1]);
check("after drag, polling resumes", M().byTab[1]?.currentTime === 99);

// no-media tab: controls are no-ops
PAGE.hasMedia = false;
await M().refresh([2]);
check("no-media tab marked hasMedia=false", M().byTab[2]?.hasMedia === false);

// multiple media tabs keep independent state
await M().refresh([10, 20]);
check("tab 10 reads as playing", M().byTab[10]?.playing === true);
check("tab 20 reads as paused", M().byTab[20]?.playing === false);
check("tab 10 keeps its own time", M().byTab[10]?.currentTime === 5);
check("tab 20 keeps its own time", M().byTab[20]?.currentTime === 80);
// toggling one does not affect the other
await M().toggle(20);
await M().refresh([10, 20]);
check("toggling tab 20 leaves tab 10 playing", M().byTab[10]?.playing === true);
check("tab 20 now playing", M().byTab[20]?.playing === true);

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
