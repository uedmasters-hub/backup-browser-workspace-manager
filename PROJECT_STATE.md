# Browser Workspace Manager — Project State

## Project Vision

A "Browser Workspace Operating System": turn Chrome windows into reusable,
styled workspaces with fast search, and grow toward command palette, browser
memory, and an AI workspace assistant.

---

## Current Status

| | |
| --- | --- |
| **Phase** | Merged: Universal Search (Level 2) + full tab management |
| **Current milestone** | Tab Search shipped; search engine fully functional |
| **Build** | ✅ Green (`tsc -b && vite build`) |
| **Lint** | ✅ Clean (`eslint .`) |
| **Search engine** | ✅ Intact; 26 search + 17 tab/sort harness checks pass |
| **Runtime** | Not yet loaded in Chrome (build verified) |
| **Git** | Initialized, `main` branch |
| **Architecture** | Stable (documented in `ARCHITECTURE.md`) |

### Recovery resolved

`tabStore` is now a complete store: `loadTabs`, selection mode, and bulk
actions (`close` / `pin` / `duplicate` / `move`) implemented on top of
`tabService` + `tabActionService`, with the window list kept in sync after
every mutation.

---

## Feature Status

| Status | Feature |
| ------ | ------- |
| ✅ | Workspace management (name, emoji, color, favorite, archive) |
| ✅ | Window management (list, focus, adaptive grid) |
| ✅ | Archive section |
| ✅ | Color + emoji picker dialogs |
| ✅ | Search engine: tiered + field-weighted scoring, fuzzy fallback, ranked & grouped |
| ✅ | Tab management (`tabStore` full: select, move, pin, duplicate, close) |
| ✅ | Live window/tab event sync while popup is open |
| ✅ | Keyboard launcher: arrow nav, Enter to run, discovery on focus |
| ❌ | Command palette |
| ❌ | Browser memory |
| ❌ | AI workspace assistant |
| ❌ | Automation |

---

## Active Stores

- `windowStore` — implemented
- `tabStore` — implemented
- `searchStore` — implemented
- `uiStore` — implemented

## Active Search Providers

- `WorkspaceProvider` — registered
- `TabProvider` — implemented & registered

---

## Folder Ownership

| Folder | Owns |
| ------ | ---- |
| `app/` | React entry + popup shell |
| `browser/` | All Chrome API access (services, storage, manifest, background) |
| `components/` | Popup UI only |
| `stores/` | Application state |
| `search/` | Query parsing, providers, indexing, ranking |
| `constants/` | Storage keys, colors, emoji |
| `types/` | Shared domain types |

> Note: `PRODUCT_SPEC.md` lists planned folders (`features/`, `hooks/`, `lib/`,
> `services/`, `utils/`) that do **not** exist yet. Create them only when a
> feature needs them (engineering rule #6).

---

## Engineering Rules

- No empty files.
- No placeholder implementations.
- Build after every change.
- One feature at a time.
- Architecture changes require justification.

---

## Next Milestone

1. Runtime verification: load `dist/` as an unpacked extension in Chrome.
2. Phase 4 — Command Palette: add a command source to the pipeline
   (new workspace, archive, toggle selection, etc.).
3. Persist recent searches across sessions (chrome.storage).
