/** App dock: the row of most-visited app icons under the window cards. */
export const APP_DOCK = {
  /** Most icons shown (the row scrolls sideways). */
  limit: 16,
  /** Visits older than this don't count towards ranking. */
  historyDays: 30,
  /**
   * With the app open in this many windows or more, clicking its icon asks
   * which window to switch to (fewer → jump straight there).
   */
  chooserMinWindows: 2,
  /** Re-rank from history at most this often (ms); open-state is always live. */
  rankingCacheMs: 10 * 60 * 1000,
} as const;
