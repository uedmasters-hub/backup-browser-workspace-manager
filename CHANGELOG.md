# Changelog

## v0.18.1 — Fix: quick note saved with empty body

### Fixed

- Saving a single-paragraph quick note put all the text into the title and left
  the body empty. The body now keeps the full text (the first line is used as
  the title and is also the first body line, Apple-Notes style), so the saved
  note opens with its content intact.

## v0.18 — Floating note: Save to Notes + New

### Added

- The floating quick note now has a footer with two actions:
  - "Save" files the current text into your Notes collection (the first
    non-empty line becomes the title, the rest become the body), with a brief
    "Saved ✓" confirmation. It appears in the popup's Notes next time you open
    it.
  - "＋ New" clears the note so you can start another one on the page.
- Note-building extracted to a small shared helper with its own harness.

## v0.17.2 — Floating note now accepts typing

### Fixed

- You couldn't type in the floating note on some sites — keystrokes were going
  to the page's own input. Sites like Claude.ai have a "type anywhere to focus
  the chat box" handler that was capturing the note's keystrokes. The note now
  keeps its keyboard, clipboard and pointer events to itself, so typing, paste
  and selection work and focus stays in the note.

## v0.17.1 — Floating note shows immediately on open tabs

### Fixed

- Toggling the floating note on did nothing on tabs that were already open. A
  declarative content script only runs on pages loaded after the extension is
  reloaded, so existing tabs had no script listening. Enabling now also injects
  the floater into all open http/file tabs right away (new tabs still get it
  automatically). The content script is idempotent, so it never double-mounts.

## v0.17 — Floating note on the page

### Added

- A floating quick note you can pin to any web page. Toggle it from the popup
  menu ("Floating note"). When on, a small, draggable card appears on the page;
  drag it by the header to place it anywhere. Its text, position and on/off
  state are saved (chrome.storage), so it's the same note on every tab and the
  ✕ on the card (or the popup toggle) hides it again.
- Implemented as a content script in an isolated shadow root (no page-style
  bleed either way), top frame only.

### Notes

- This is a separate lightweight scratch note, kept intentionally minimal; the
  full block notes (with lock/encryption, export) still live in the popup.
- The floater can't appear on pages where extensions are blocked (chrome://
  pages, the Web Store). Adds a content script on <all_urls> (host access was
  already granted); reload the unpacked extension to register it.

## v0.16.2 — Clean "Switch to tab" hover on search

### Fixed

- The "Switch to tab" hint no longer jitters or only appears in the gap between
  cards. It was set to hide on hover, so it only showed when a card was the
  active (keyboard) row but not hovered. It now appears cleanly on hover and
  stays for the keyboard-active row; the relative age shows only at rest.

### Changed

- Removed the seek slider from search results (kept on the home cards). Search
  media cards keep play/pause (over the favicon), mute/unmute, the now-playing
  indicator, and the current-page accent — the search flow is find → switch →
  play/pause/mute.

## v0.16.1 — Fix search slider, multi-media accuracy, current-page indicator

### Fixed

- Seek slider now works on the search page. The card's mousedown handler (which
  keeps the search box focused) was swallowing the slider's drag; the slider now
  stops its own pointer events from bubbling.
- With several media tabs open, each card now reflects its own true play state:
  the in-page picker prefers the actually-playing element (then longest), and
  the now-playing badge follows the real state instead of the audible flag.
- Media tabs that pause keep their controls — polling now also covers tabs
  already known to have media, not just currently-audible ones.

### Added

- Current-page indicator: the active tab shows a left accent bar on both the
  home and search cards.

## v0.16 — Consistent card style across home and search

### Changed

- Search results now use the same white rounded-card style as the home list
  (gray background, shadowed cards, matching icon, title weight and spacing)
  instead of the old tight borderless rows.
- Tab results in search are now full media cards: play/pause over the favicon
  on hover, mute/unmute, the relative age, and the real draggable seek slider
  pinned to the card bottom (the search row is no longer a <button>, so the
  slider works there too).
- Extracted shared MediaSeek and the age formatter so home and search render
  identical controls from one source.

## v0.15.1 — Media controls on search; uniform card height

### Fixed

- The home media card grew taller because the seek slider added a row. The
  slider is now pinned to the card's bottom edge, so media cards keep the same
  height as every other card.

### Added

- Search results now reflect media too: tab results that are playing show the
  now-playing equalizer badge, a play/pause button on hover, a mute/unmute
  control, and a thin progress bar along the row bottom.
- Media polling now runs on the search view as well (paused only while notes
  are open), so search reflects live play state.

### Notes

- The precise drag-to-seek slider stays on the home cards; search rows show a
  read-only progress bar (a draggable slider can't nest inside the search row's
  button), plus play/pause and mute.

## v0.15 — Full media controls on media tabs

### Added

- Play / pause: hovering a media tab swaps its favicon for a play/pause button
  that controls the page's <video>/<audio>.
- Seek slider: a thin red progress line under the title that becomes a
  draggable scrubber on hover — dragging seeks the media precisely on release.
- Live progress: play state and position refresh ~1×/sec while the home list is
  open (paused while you're dragging the slider).
- Mute / unmute stays as before. Controls appear only on media tabs.

### Permissions

- Adds the "scripting" permission (host access / <all_urls> was already present)
  so the extension can read and control each tab's media element.

### Implementation

- mediaService (chrome.scripting): reads the primary media element across
  frames (longest finite duration) and controls that same frame for toggle/seek.
- mediaStore: per-tab state, optimistic toggle/seek, drag-aware polling.
- Note: tabs that can't be scripted (chrome:// pages, the Web Store) simply
  show no controls; pages with several videos may occasionally pick a different
  element than expected.

## v0.14 — Media tabs: now-playing indicator + mute/unmute

### Added

- Media tabs (playing audio) get an interactive treatment:
  - an animated equalizer badge on the favicon while playing (a muted badge
    when muted),
  - a persistent mute / unmute button on the row (Volume2 / VolumeX) that uses
    chrome.tabs muted state — works without extra permissions.
- Tab model now tracks `muted`; tabStore.toggleMuteTab; tabActionService.setTabMuted.
- Only media tabs show these controls; all other rows are unchanged.

### Notes

- Pause/play, a working seek slider, and live progress are NOT included here:
  they require the `scripting` permission + host access to read/control each
  page's <video>/<audio>, which is a separate (and heavier) permission decision.

## v0.13.2 — Fix duplicate trailing empty block in notes

### Fixed

- Notes could show two empty trailing lines. The lock "hide on leave" step
  cleared the reveal flag and emptied the blocks in two separate updates, which
  briefly let the editor add a stray trailing block; that update is now atomic.
- Hardened the trailing-line invariant to keep exactly one empty line at the end
  (collapsing any accidental duplicates on blur).

## v0.13.1 — Lock screen polish

### Changed

- Removed the "Unlocked for this session…" banner in the editor.
- Redesigned the locked-note screen: centered lock badge with a soft ring, a
  clean centered PIN field (with a shake + "Incorrect PIN" on a wrong entry),
  a full-width Unlock button, and an inline "Delete this note" mode (PIN-gated).

## v0.13 — Notes: real encryption lock (not just delete protection)

### Changed

- Locking a note now ENCRYPTS its contents at rest (AES-GCM, PBKDF2-derived key
  from your PIN). A locked note is unreadable without the PIN:
  - Opening it shows a lock screen; the content only decrypts after the correct
    PIN is entered (for that session).
  - Export (download) and editing are unavailable until unlocked.
  - Deleting requires the PIN.
  - The notes list shows "Locked · encrypted" instead of any preview.
  - Leaving the note re-secures it (plaintext dropped from memory; only
    ciphertext is stored). Backups contain only the ciphertext, never the text.
- The lock button toggles protection: lock (set a PIN) ⇄ remove lock (while
  unlocked). Notes you don't lock are unaffected.

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
