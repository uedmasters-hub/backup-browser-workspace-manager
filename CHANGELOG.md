# Changelog

## v0.12 — Notes: no global header; optional per-note PIN lock

### Fixed

- The global search header no longer renders on the Notes page (it was
  overlapping the note's own header/title/actions). Keyboard shortcuts
  (Cmd/Ctrl+J, focus-search, open-notes) stay active.

### Added

- Optional per-note PIN lock (privacy). Lock a note from its header; a locked
  note shows a lock badge and can't be deleted without entering the PIN
  (verification required from both the note view and the notes list). Unlocking
  also requires the PIN. Notes left unlocked behave exactly as before.

## v0.11.1 — Extension icon

### Added

- Real extension icon (16/32/48/128) from the provided logo, wired into the
  manifest `icons` and `action.default_icon`. Replaces Chrome's auto-generated
  "B" placeholder on the toolbar and extensions page.

## v0.11 — Import is now a full restore

### Changed

- Import no longer just writes settings — it rebuilds the whole system from a
  backup: re-creates every window with its tabs (in order), re-applies pinned
  state, rebuilds each tab group (title, color, collapsed), and restores
  favorites, notes, sort mode and archived/name/emoji/color metadata (re-mapped
  onto the freshly created window ids). Export already captured every window
  (not just the current one). Now delete everything, import later, and your
  windows/groups/pins/favorites/notes come back.

### Notes

- Restore is non-destructive: it opens the backed-up windows alongside whatever
  you already have (it won't close current windows from the popup). Tabs on
  restricted schemes (chrome://, extension pages, etc.) can't be reopened by an
  extension and are skipped; the rest restore normally.

## v0.10.2 — Header menu renders in the top layer

### Fixed

- The header menu (Sync/Notes/Export/Import) could be overlapped by the tab
  list's Sort/Select row. It now renders through a portal to document.body at a
  high z-index, positioned under the hamburger, so it always sits above page
  content regardless of stacking contexts.

## v0.10.1 — Backup: drop external zip dependency

### Fixed

- Removed the `fflate` dependency that broke a from-source `npm run build`
  ("Cannot find module 'fflate'") when node_modules wasn't reinstalled. ZIP
  read/write is now a small built-in module (STORE method), so the build needs
  no extra install. Export/import behaviour is unchanged.

## v0.10 — Backup: export / import (in the menu)

### Added

- Export backup (hamburger menu): downloads a single ZIP "folder" containing
  - backup.json — everything persisted (notes, favorites, sort mode, archived
    workspaces and all other settings) plus a live snapshot of every window,
    group and tab;
  - tabs.html — a standalone, dependency-free page listing all tabs as clickable
    links (grouped by window/group, favorites starred). Open it anywhere, no
    extension required;
  - README.txt.
- Import backup (hamburger menu): restores from a .zip or a raw backup.json,
  writes the settings back, and reloads the popup so notes/favorites/sort/etc.
  take effect. Non-backup files are rejected with a clear message.

### Notes

- Workspace name/color/emoji/archive are keyed by Chrome window id, which changes
  between browser restarts, so those map cleanly only within the same session;
  notes, favorites (by URL) and sort restore across sessions.

## v0.9.5 — Chrome-level Notes shortcut

### Added

- A browser-level "Open Notes" command (manifest `commands`) so Notes can be
  opened without first clicking the extension. Defaults: Command+J (macOS),
  Alt+J (Windows/Linux). The background opens the popup and signals it (session
  flag + message) to show Notes on arrival. Rebindable at
  chrome://extensions/shortcuts. The in-popup Cmd/Ctrl+J still works too.

## v0.9.4 — Header menu, search Select, close tab, group alignment

### Added

- Header hamburger menu consolidating Sync and Notes; Notes also opens with a
  Cmd/Ctrl+J hotkey. The menu is hidden while searching.
- Explicit "Select" toggle on the search results (instead of always-on hover
  checkboxes): turn it on to pick tabs, then Group them; turn it off to browse.
- Close a tab directly from the extension — a close (X) button on each home tab
  row and on each tab result in search.

### Fixed

- Grouped tabs now align to the front of the window reliably: the group is moved
  to just after any pinned tabs (Chrome forbids placing groups before pinned
  tabs), with a safe fallback.

## v0.9.3 — Manual Sync button

### Added

- A Sync button in the header re-pulls the current windows and tabs on demand
  (refresh windows + reload the active window's tabs). It spins while syncing,
  briefly shows a check on success, and its tooltip reports the last-synced time
  (persisted, so it survives reopening the popup). Live event-based updates stay
  on; this is an explicit, on-demand refresh.

## v0.9.2 — Remove drag; reorder via menu; groups stay first

### Changed

- Removed tab/group drag-and-drop (it was unreliable). Reordering is now done
  from the group's menu: Move Left/Right and Shuffle tabs (shuffle switches the
  list to manual order so the result is visible). Drag handles/grips are gone.
- When tabs are grouped (from search selection or bulk-select), the new group is
  moved to the front of the window, so grouped tabs stay first and ungrouped
  tabs follow — in the browser, not just in the panel.

## v0.9.1 — Search results: tighter, professional list

### Changed

- Replaced the bulky bordered result cards (white boxes on grey with large
  padding) with a continuous white list: borderless rows, denser spacing, and a
  subtle highlight on hover/active/selection. Smaller icon tiles and tighter
  section headers remove the excess whitespace.

## v0.9 — Search: select & group tabs, clear recent searches

### Added

- Multi-select in search results: each tab result has a checkbox (on hover, or
  always once a selection is active). Pick several — e.g. search "chat" and
  select Claude, ChatGPT, Gemini — then a bottom bar groups them into one Chrome
  tab group in a click, named after your search. Tabs spread across windows are
  gathered into one window first, then grouped.
- "Clear" action next to Recent searches.

## v0.8.5 — Search typing fix + note icon

### Fixed

- Typing in the search box could snap back / feel like the page was refreshing.
  The async search was writing its (already-stale) query back into the store on
  completion, overwriting newer keystrokes. Search now leaves the input value
  alone, ignores results from out-of-date queries, and keeps the current list
  visible instead of flashing a spinner on every keystroke.

### Changed

- The header button now always shows a note icon.

## v0.8.4 — Notes: cleaner block controls

### Fixed

- Block action buttons (copy / move / delete) no longer overlap text or a
  block's own controls (e.g. the password Unlock button). They now sit in a
  small opaque toolbar on the block's top edge.
- The toolbar appears only on hover and is hidden while you're editing a block,
  so it never shows up mid-typing. Hovering its buttons no longer steals focus.

## v0.8.3 — Notes: trailing-line discipline, simpler unlock, cleaner editor

### Changed

- The trailing empty line no longer appears while you type. It's added only
  when you **leave** a block, and only when that last block has content — so
  you'll never see (or accumulate) blank lines stacked under a blank block.
  Enter on an empty line does nothing.
- Password block is simpler when locked: just the label and an **Unlock**
  button. The PIN field appears only after you tap Unlock (Enter to open,
  Esc to dismiss) instead of always showing a redundant PIN box.
- Removed the "Press / to insert a block" helper line under the editor.

## v0.8.2 — Notes: slash menu no longer clipped

### Fixed

- The "/" block menu was being cut off by the editor's scroll area near the
  bottom of the popup. It now renders above the popup in a fixed overlay,
  flips above the line when there isn't room below, caps its height with its
  own scroll, and closes if the list scrolls — so every option stays visible.

## v0.8.1 — Notes: always-available trailing line

### Fixed

- You could get stuck after a non-text block (password, checklist, divider…)
  because Enter only adds a line from inside a text block. The editor now keeps
  a single empty text line at the end at all times and regenerates it
  automatically after any block, so there's always somewhere to type — no
  dependence on Enter.
- Enter now reuses that trailing empty line instead of creating duplicate blank
  blocks, and Backspace on an empty line moves focus up to the previous block.

## v0.8 — Notes: global, multi-note, slash commands, export

Reworked Workspace Notes based on feedback.

### Changed

- Notes are now **global**, shared across every window — not tied to one
  workspace.
- You can keep **as many notes as you like**. The panel opens to a notes list;
  each note has its own title, preview, and last-edited time.
- Opening or creating a note is **never blank**: it starts with a focused
  text block ("Write something, or press /").
- Block creation is now **Notion-style**: type **"/"** in any text block to
  turn it into Text, Checklist, Link, Password, Callout, or Divider (filter by
  typing, arrow keys + Enter to choose). Press **Enter** for a new line block.
  The full-width "New block" CTA has been removed.

### Added

- **Download as .txt**: export any note to a local text file from the editor.
- New-note button, per-note delete, and in-list search across titles and
  content.

### Verified

- `tsc` + `eslint` clean, build green. Notes harness: 17 checks (crypto,
  create, slash-transform, insert-after, reorder, title, export, multi-note
  persistence). Search (26) and tab/sort (17) harnesses still pass.

## v0.7 — Workspace Notes

Each workspace gets its own continuous note, opened from the header's menu
button (now a toggle that lights up blue when active and is aligned to the
search bar's height).

### Added

- Workspace Notes: a fast, distraction-free note per workspace, built from
  simple blocks — Text, Checklist, Link, Callout, Divider, and a PIN-protected
  Password block.
- Password blocks encrypt their secret with a per-block PIN (PBKDF2 + AES-GCM)
  and unlock individually, so revealing one secret never exposes the rest of
  the note. Plaintext is never persisted; a revealed value lives only in memory
  until hidden.
- One-click copy on every block (text, checklist as a list, link URL, callout,
  and unlocked password value).
- Sticky search bar to filter blocks within a note, a clean bottom "New block"
  action with a type picker, subtle hover actions (move/copy/delete) in a left
  gutter, and a white, generously spaced interface.
- Notes persist per workspace in local storage (debounced), isolated by window.

### Changed

- Header menu button is aligned to the search field height and toggles the
  notes panel, showing an active (blue) state while open.

### Verified

- `tsc` + `eslint` clean, production build green. Notes harness: 11 checks
  (crypto round-trip, wrong-PIN rejection, block ops, reorder, per-workspace
  persistence). Existing search (26) and tab/sort (17) harnesses still pass.

## v0.6 — Merge: Universal Search (Level 2) + restored tab management

This release reconciles two diverged repositories. The latest implementation of
every feature is treated as the source of truth: the search engine is kept
intact, and the tab-management features that an earlier outdated commit had
reverted are restored from the backup.

### Kept intact (search engine — source of truth in the working repo)

- Level-1 instant search (workspaces, tabs) and Level-2 Universal Search
  (bookmarks, history, downloads, recently closed sessions, archived workspaces).
- Grouped result sections with per-source caps, cross-source URL de-duplication,
  per-provider timeouts, lazy Level-2 gating, and the existing ranking behavior.

### Restored (were reverted by the previous outdated commit)

- Complete tab group management: create, rename, recolor, set emoji,
  expand/collapse, move, shuffle, group/ungroup (TabGroupCard, GroupTabsDialog,
  tabGroupService, tab-group colors).
- Tab sort modes with persistence (tabSortRepository, tabSelectors); favorites
  are always pinned first in every user-selectable sort mode.
- Rich TabItem: favicon, title, filled favorite star, always-visible relative
  tab age with hover animation; hover-only favorite action for non-favorites;
  subtle star styling. Favorite controls live only on tab rows.
- Fixed 420×600 popup with a fixed header + search bar; content-only scrolling;
  search focus uses `preventScroll`.
- Keyboard search shortcuts: ⌘K / Ctrl+K / "/", plus the global `focus-search`
  command (Ctrl/Cmd+Shift+K) that opens the popup and focuses search.
- Full-page error recovery (PopupErrorBoundary) and proper event-listener
  cleanup; live Chrome synchronization with safe `tabGroups` capability
  detection.

### Reconciled seams

- Favorites unified on a single URL-based store (`tabFavoriteRepository`,
  `FAVORITE_TABS` key) used by both the tab list and search.
- Workspace-level favorites removed; the search engine no longer references a
  workspace favorite (tab-favorite ranking is unchanged).
- Manifest merged: search permissions (bookmarks/history/downloads/sessions) +
  the `focus-search` command.

### Verified

- `tsc` + `eslint` clean; production build green; manifest carries all
  permissions and the command. Harnesses: 26 search checks + 17 tab/sort checks.
