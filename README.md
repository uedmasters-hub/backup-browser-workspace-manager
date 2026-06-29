# Browser Workspace Manager

A Chrome (Manifest V3) extension that turns ordinary browser windows into
named, reusable **workspaces** — each with its own emoji, color, cover image,
favorite and archive state — so multitasking stays organized and tab overload
goes away.

The popup is a fast, native-feeling surface (420 × 640) for viewing, focusing,
renaming and styling your windows, plus a search subsystem for finding windows
and tabs.

> **Status:** active development. The build is currently **broken** pending the
> `tabStore` restoration milestone — see [`PROJECT_STATE.md`](./PROJECT_STATE.md).

---

## Features

| Status | Feature |
| ------ | ------- |
| ✅ | Workspace metadata (name, emoji, color, favorite, archived) persisted to `chrome.storage.local` |
| ✅ | Window listing, focus, and adaptive grid layout (1 / 2 / 3 / 4 / overflow) |
| ✅ | Archive section + favorites sorting |
| ✅ | Color picker / emoji picker dialogs |
| 🚧 | Search pipeline (engine + providers + indexers) — Workspace search wired, Tab search next |
| 🚧 | Tab management (`tabStore` is currently a non-compiling skeleton) |
| ❌ | Command palette, browser memory, AI assistant, automation (roadmap) |

See the full plan in [`ROADMAP.md`](./ROADMAP.md).

---

## Tech Stack

- **React 19** + **TypeScript**
- **Vite 8** with [`@crxjs/vite-plugin`](https://crxjs.dev/) for MV3 bundling
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **Zustand** for state (`windowStore`, `tabStore`, `searchStore`, `uiStore`)
- **Chrome Manifest V3** APIs: `chrome.tabs`, `chrome.windows`, `chrome.storage`
- Supporting libs available in `package.json`: React Query, React Hook Form, Zod,
  Framer Motion, Lucide icons (not all are wired in yet)

The manifest is defined in code at [`src/browser/manifest.ts`](./src/browser/manifest.ts)
and consumed by the CRX Vite plugin.

---

## Getting Started

```bash
# install dependencies
npm install

# start the dev server (HMR)
npm run dev

# typecheck + production build -> dist/
npm run build

# lint
npm run lint
```

### Loading the extension in Chrome

1. Run `npm run build` to produce `dist/`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. The popup is served from `src/browser/popup/index.html`; the background
   service worker is `src/browser/background/index.ts`.

---

## Project Layout

```
src/
  app/         App shell + React entry (App.tsx, main.tsx)
  browser/     Chrome-facing layer: manifest, background, popup html,
               services (windows/tabs), storage repository, events, mappers
  components/  Popup UI (window cards, dialogs, menus, search panel, archive)
  constants/   Storage keys, color palettes, emoji set
  search/      Self-contained search subsystem (see ARCHITECTURE.md)
  stores/      Zustand stores + selectors
  types/       Shared domain types (workspace, window, tab)
  index.css    Tailwind entry
```

Architecture and dependency rules: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
Contributing workflow and conventions: [`docs/DEVELOPMENT_GUIDE.md`](./docs/DEVELOPMENT_GUIDE.md).
Product specification: [`docs/PRODUCT_SPEC.md`](./docs/PRODUCT_SPEC.md).

---

## Engineering Principles

1. No speculative code, no empty files, no placeholder implementations.
2. Every feature must compile; build after every milestone.
3. Extend existing modules before creating new ones.
4. Every new file must be used immediately.
5. Architecture evolves through implementation, not anticipation.
6. Update `PROJECT_STATE.md` before starting the next milestone.
7. Simplicity over abstraction.
