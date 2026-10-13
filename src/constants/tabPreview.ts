/**
 * Hover preview for tab rows.
 *
 * Set `enabled` to false to switch previews off without removing code.
 * Times are in milliseconds.
 */
export const TAB_PREVIEW = {
  enabled: true,
  /** Hover this long on a row before the first preview opens. */
  openDelayMs: 450,
  /** While a preview is open (or was just closed), moving to another row switches this fast. */
  switchDelayMs: 90,
  /** Grace period when the pointer leaves a row. */
  closeDelayMs: 120,
  /** Snapshot size stored in memory. */
  thumbnailWidth: 480,
  thumbnailQuality: 0.62,
  /** Most snapshots kept at once (oldest dropped first). */
  maxThumbnails: 80,
} as const;
