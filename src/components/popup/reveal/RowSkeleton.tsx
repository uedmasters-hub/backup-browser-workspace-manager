import { SCROLL_SKELETON } from "../../../constants/scrollSkeleton";
import type { RevealPhase } from "./useScrollReveal";

/** Title-bar widths, varied per row so the skeleton list doesn't look stamped. */
const TITLE_WIDTHS = ["62%", "74%", "50%", "68%", "56%"];

/**
 * Covers a tab row (inside its own rounded card) with a shimmering
 * placeholder that mirrors the row: favicon · title · age.
 */
export default function RowSkeleton({
  phase,
  seed,
}: {
  phase: RevealPhase;
  seed: number;
}) {
  if (phase === "content") return null;

  return (
    <div
      aria-hidden="true"
      style={{ transitionDuration: `${SCROLL_SKELETON.fadeMs}ms` }}
      className={[
        "pointer-events-none absolute inset-0 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 transition-opacity ease-out",
        phase === "fading" ? "opacity-0" : "opacity-100",
      ].join(" ")}
    >
      <span className="bwm-skeleton h-5 w-5 shrink-0 rounded-md" />
      <span
        className="bwm-skeleton h-3 rounded-full"
        style={{ width: TITLE_WIDTHS[Math.abs(seed) % TITLE_WIDTHS.length] }}
      />
      <span className="bwm-skeleton ml-auto h-2.5 w-7 shrink-0 rounded-full" />
    </div>
  );
}
