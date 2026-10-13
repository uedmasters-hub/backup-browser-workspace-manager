/**
 * Skeleton-on-scroll for the tab list.
 *
 * Set `enabled` to false to switch the effect off without removing code.
 * Timings are in milliseconds.
 */
export const SCROLL_SKELETON = {
  enabled: true,
  /** How long a row shows its skeleton after it scrolls into view. */
  holdMs: 260,
  /** Extra delay per row when several arrive together (top to bottom). */
  staggerMs: 50,
  /** Cap on how many rows the stagger stretches across. */
  maxStagger: 5,
  /** Crossfade from skeleton to the real row. */
  fadeMs: 220,
} as const;
