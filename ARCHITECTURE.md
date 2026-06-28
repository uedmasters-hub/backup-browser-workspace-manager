# Architecture

Browser Workspace Manager is a Manifest V3 Chrome extension. The code is split
into clear layers so that Chrome APIs, business logic, and UI never blur
together.

---

## Layered Overview

```
                ┌─────────────────────────────────────────┐
   UI layer     │  components/  (popup React tree)          │
                └───────────────┬───────────────────────────┘
                                │ reads/dispatches
                ┌───────────────▼───────────────────────────┐
   State layer  │  stores/  (Zustand: window/tab/search/ui)  │
                └───────────────┬───────────────────────────┘
                  │                       │
        ┌─────────▼─────────┐   ┌─────────▼──────────────────┐
 Domain │  search/          │   │  browser/services + storage │  Chrome layer
        │ (engine,providers,│   │ (chrome.tabs / windows /     │
        │  indexers, models)│   │  storage wrappers)           │
        └───────────────────┘   └──────────────────────────────┘
                                │
                ┌───────────────▼───────────────────────────┐
   Platform     │  chrome.* APIs + background service worker  │
                └─────────────────────────────────────────────┘
```

---

## Folder Structure

```
src/
├─ app/
│  ├─ App.tsx          # Popup shell: Header + WindowSection + dialogs
│  └─ main.tsx         # React root, mounts <App/>
│
├─ browser/            # Everything that touches Chrome directly
│  ├─ manifest.ts      # MV3 manifest (source of truth, consumed by CRX plugin)
│  ├─ background/      # Service worker (onInstalled, future event handlers)
│  ├─ popup/           # popup index.html entry
│  ├─ services/        # tabService, tabActionService, windowService, windowMapper
│  ├─ storage/         # workspaceRepository (chrome.storage.local CRUD)
│  ├─ events/          # windowEvents
│  └─ mockWindows.ts   # dev/test fixtures
│
├─ components/popup/   # 42 presentational + container components
│  ├─ window-card/     # WindowCard + Header/Footer/Menu/State/Handlers
│  ├─ windows/         # adaptive grid: Single/Two/Three/Four/Overflow + WindowGrid
│  ├─ dialogs/         # BaseDialog + Color/Emoji/MoveTabs + Dialog* primitives
│  ├─ menus/           # BaseMenu, WorkspaceMenu, Portal
│  ├─ search/          # SearchBar, SearchPanel, SearchOverlay, result views
│  └─ archived/        # ArchivedHeader, ArchivedWorkspaceCard
│
├─ constants/          # storageKeys, windowColors, workspaceColors, workspaceEmojis
├─ search/             # self-contained search subsystem (see below)
├─ stores/             # Zustand stores + selectors/
└─ types/              # workspace.ts, window.ts, tab.ts
```

---

## Dependency Rules

- **UI → stores → (search | browser).** Components never call `chrome.*`
  directly; they go through stores, which call services.
- **Every Chrome API is wrapped in `browser/services` or `browser/storage`.**
  This keeps the rest of the app testable and mockable.
- **`search/` is self-contained.** It depends only on its own models plus the
  storage repository; it does not import UI or stores.
- **`types/` depends on nothing** and is imported everywhere.
- Business logic never lives inside UI components.

---

## Store Architecture

Four Zustand stores, each with a single responsibility:

| Store | Responsibility |
| ----- | -------------- |
| `windowStore` | Source of truth for windows. `refreshWindows()` reads Chrome windows + persisted metadata and merges them via `windowMapper`. Owns rename/color/emoji/archive/delete, all of which persist through `workspaceRepository`. |
| `tabStore` | Tab and native group listing, URL-backed favorites, multi-select mode, bulk tab actions, and Chrome-backed group mutations (membership/collapse/title/color/order). |
| `searchStore` | Query string, status (`idle`/`searching`/`success`/`empty`/`error`), results, recent searches, and `@deep` mode. Delegates to `SearchEngine`. |
| `uiStore` | View mode, loading, and which dialog/menu/workspace is active. Pure UI state, no persistence. |

State that must survive a popup close lives in `chrome.storage.local`
(via `workspaceRepository` and `tabFavoriteRepository`), not in the stores.

---

## Browser Layer

- `windowService` — thin wrappers over `chrome.windows` (getAll, getCurrent, focus).
- `tabService` / `tabActionService` — `chrome.tabs` reads and mutations.
- `tabGroupService` — `chrome.tabs.group/ungroup` and `chrome.tabGroups` reads, updates, collapse, color, and movement.
- `tabFavoriteRepository` — favorite tab URLs in `chrome.storage.local`.
- `windowMapper` — converts a raw `chrome.windows.Window` + stored
  `WorkspaceMetadata` into the app's `WorkspaceWindow` view model.
- `workspaceRepository` — CRUD over the `workspaces` key in `chrome.storage.local`
  (`getWorkspaces`, `upsertWorkspace`, `getWorkspace`, `removeWorkspace`,
  `clearWorkspaces`).
- `background/index.ts` — MV3 service worker; currently logs install, the hook
  point for future window/tab event syncing.

---

## Search Architecture

`src/search/` is a small, layered query engine designed to grow new content
types without touching the UI:

```
input string
   │
QueryParser ──> SearchQuery (raw + parsed flags, e.g. @deep)
   │
SearchEngine.search() ──> SearchPipeline.run()
   │
ProviderRegistry ──> [ WorkspaceProvider, (TabProvider next) ... ]
   │                        each provider produces SearchableEntity items
Normalizer / Tokenizer / Ranker ──> ResultGrouper / Sorter / Limiter
   │
SearchResult[] ──> searchStore ──> SearchPanel UI
```

Key parts:

- **`engine/`** — `SearchEngine` (entry), `SearchPipeline`, plus
  `SearchNormalizer`, `SearchTokenizer`, `SearchRanker`.
- **`providers/`** — `ProviderRegistry` (registered at app start in `App.tsx`),
  `SearchProvider` interface, `WorkspaceProvider`, `TabProvider`.
- **`entities/`** — `SearchableEntity` and concrete searchables (Workspace, Tab,
  Bookmark, History, Download, Session, Page, Clipboard, Archive).
- **`indexers/`** — `BaseIndexer`, `WorkspaceIndexer`, and a `pipeline/`
  (Keyword/Metadata indexers + `SearchIndexBuilder`).
- **`mappers/`**, **`parsers/`**, **`repositories/`**, **`results/`**, **`models/`**
  — supporting layers; `models/` re-exports all search types via `index.ts`.

`WorkspaceProvider` and `TabProvider` are registered; the entity/indexer
scaffolding for other content types exists for later phases.

---

## Data Flow (example: rename a workspace)

1. User edits the name in `WindowCard` → `RenameInput`.
2. Component calls `windowStore.renameWorkspace(chromeWindowId, name)`.
3. Store builds a merged `WorkspaceMetadata` and calls
   `workspaceRepository.upsertWorkspace(...)` → `chrome.storage.local`.
4. Store calls `refreshWindows()`, which re-reads Chrome windows + metadata and
   re-maps them.
5. Components re-render from the updated `windows` array.

---

## Design Principles

Rounded, soft shadows, minimal, readable, accessible, motion-first,
content-first. Target quality bar: Apple / Arc Browser. Full UX detail lives in
[`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md).

---

## Future Extension Points

- Register Bookmark/History/etc. providers in `ProviderRegistry`.
- Add a command palette on top of the existing search pipeline.
- Use the background service worker to live-sync window/tab events.
- Add `chrome.storage.sync` for cross-device workspace metadata.

---

## Engineering Principles

1. No speculative code.
2. No empty files.
3. No placeholder implementations.
4. Every feature must compile.
5. Extend existing modules before creating new ones.
6. Every new file must be used immediately.
7. Architecture evolves through implementation, not anticipation.
8. Build after every milestone.
9. Update PROJECT_STATE before starting the next milestone.
10. Simplicity over abstraction.
