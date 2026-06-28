# Changelog

## v0.4 — Click to switch

### Added

- Clicking a tab row now switches to that tab: activates it and focuses its
  window (popup then closes). Selection mode still toggles selection instead.
- `tabStore.activateTab(tabId)` looks up the tab's window and calls the
  `activateTab` Chrome service.

## v0.3 — Keyboard Launcher

### Added

- Search is now a keyboard-driven launcher
  - Arrow Up/Down to move between results (wraps around), Enter runs the top
    action, Escape clears and closes
  - Active row highlighted with the primary action label + Enter affordance,
    auto-scrolled into view
  - Mouse hover syncs the active row
- Discovery: focusing the empty search box surfaces favorites + recent tabs
- Recent searches shown as quick chips in discovery
- Flat ranked result list (replaces source grouping) for launcher-grade nav

### Changed

- Overlay now opens on focus (not only when typing)
- `searchStore` tracks `focused` + `activeIndex`; added `discover`, `moveActive`,
  `runActive`

## v0.2 — Search & Recovery

### Added

- Fully functional search engine
  - `SearchScorer`: tiered matching (exact → prefix → word-prefix → substring →
    fuzzy subsequence), field weighting, multi-token AND, contiguous-phrase bonus
  - Favorite / active / recency relevance boosts
  - `TabProvider` implemented and registered alongside `WorkspaceProvider`
  - Results ranked, limited, and grouped by source in the UI
  - `@deep` mode raises URL weight for deeper tab matching
- Tab management: `tabStore` fully implemented (load, select, move, pin,
  duplicate, close) with window-count sync after mutations
- Search experience wired into the popup (Header drives the engine; results
  view with highlights and click-to-open/switch actions)
- Archive restore action (`restoreWorkspace`) and working restore/delete in the
  archived section
- Live window/tab event sync while the popup is open

### Changed

- Search pipeline now ranks + limits via `SearchRanker` / `ResultLimiter`
- `WorkspaceMapper` carries emoji/color; added `TabMapper` + `TabRepository`
- Picker dialogs and rename state use render-time sync (no setState-in-effect)

### Fixed

- `tabStore` no longer breaks the build (was a malformed store body)
- Removed debug `console.log` noise from the search path
- Removed unused `SearchBar` / `SearchOverlay`; `eslint .` now passes clean

## v0.1

### Added

- Search Engine
- Providers
- Search Pipeline
- Repository Layer
- Mapper Layer
- Indexer Layer
- Window Management
- Archive Support
- Favorites
- Emoji
- Colors

### Changed

- Search Architecture Stabilized

### Fixed

- Search model exports
- Entity exports
- TypeScript build errors