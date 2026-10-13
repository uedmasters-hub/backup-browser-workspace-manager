import { useEffect, useState } from "react";
import type { RefObject } from "react";

import { SCROLL_SKELETON } from "../../../constants/scrollSkeleton";

/**
 * "content"  — show the real row (initially on screen, or effect off)
 * "skeleton" — placeholder shown while the row waits off screen / just arrived
 * "fading"   — skeleton crossfading out
 */
export type RevealPhase = "content" | "skeleton" | "fading";

type Report = (visible: boolean, firstReport: boolean, batchIndex: number) => void;

const reporters = new Map<Element, Report>();
const reported = new WeakSet<Element>();
let observer: IntersectionObserver | null = null;

/** One shared observer for every row — cheap even for hundreds of tabs. */
function sharedObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver((entries) => {
    let batch = 0;
    for (const entry of entries) {
      const first = !reported.has(entry.target);
      reported.add(entry.target);
      const report = reporters.get(entry.target);
      if (!report) continue;
      report(entry.isIntersecting, first, entry.isIntersecting ? batch++ : -1);
    }
  });
  return observer;
}

function motionAllowed(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof IntersectionObserver !== "undefined" &&
    !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Rows already on screen render immediately. Rows below the fold switch to a
 * skeleton while still off screen (invisible to the user), then reveal shortly
 * after they scroll into view. Each row reveals once.
 */
export function useScrollReveal(ref: RefObject<Element | null>): RevealPhase {
  const [phase, setPhase] = useState<RevealPhase>("content");

  useEffect(() => {
    const el = ref.current;
    if (!el || !SCROLL_SKELETON.enabled || !motionAllowed()) return;

    const io = sharedObserver();
    const timers: number[] = [];

    const stop = () => {
      io.unobserve(el);
      reporters.delete(el);
    };

    reporters.set(el, (visible, first, batchIndex) => {
      if (first) {
        if (visible) {
          stop(); // on screen from the start: never skeleton
        } else {
          setPhase("skeleton");
        }
        return;
      }
      if (!visible) return;

      stop();
      const { holdMs, staggerMs, maxStagger, fadeMs } = SCROLL_SKELETON;
      const delay = holdMs + Math.min(batchIndex, maxStagger) * staggerMs;
      timers.push(
        window.setTimeout(() => setPhase("fading"), delay),
        window.setTimeout(() => setPhase("content"), delay + fadeMs)
      );
    });
    io.observe(el);

    return () => {
      stop();
      reported.delete(el);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [ref]);

  return phase;
}
