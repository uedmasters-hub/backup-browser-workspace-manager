# Development Guide

## Prerequisites

- Node.js 20+ and npm
- Google Chrome (for loading the unpacked extension)

## Getting started

```bash
npm install
npm run dev      # Vite dev server with HMR
```

## Build

```bash
npm run build    # tsc -b && vite build  ->  dist/
```

A build only counts as done if `tsc` passes **and** `vite build` produces
`dist/`. The current `tabStore` defect (see `PROJECT_STATE.md`) fails `tsc`.

## Run (load in Chrome)

1. `npm run build`
2. Visit `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → select `dist/`.
4. Click the extension icon to open the popup.
5. After code changes, rebuild and hit **Reload** on the extension card.

## Lint

```bash
npm run lint     # ESLint (flat config in eslint.config.js)
```

---

## Coding standards

- One component, one responsibility. No duplicated UI.
- Everything typed — no implicit `any`.
- Every `chrome.*` call lives in `browser/services` or `browser/storage`.
  UI and stores never call Chrome APIs directly.
- Business logic stays out of UI components; it belongs in stores/services.
- No inline mock data once a real data path exists (`mockWindows.ts` is dev-only).
- Prettier + `prettier-plugin-tailwindcss` for formatting.

## Folder ownership

See the table in [`../ARCHITECTURE.md`](../ARCHITECTURE.md). In short:
`browser/` = Chrome, `components/` = UI, `stores/` = state,
`search/` = query engine, `types/` = shared types. Don't create the
spec's planned folders (`features/`, `hooks/`, `lib/`, `utils/`) until a feature
actually needs them.

---

## Definition of Done

- [ ] Compiles (`npm run build` is green).
- [ ] Lints clean (`npm run lint`).
- [ ] No empty files, no placeholder/stub implementations.
- [ ] Every new file is imported and used.
- [ ] Chrome access is wrapped in a service/repository.
- [ ] `PROJECT_STATE.md` updated if status or milestone changed.
- [ ] `CHANGELOG.md` updated for user-visible changes.

---

## How to add a feature

1. Confirm it fits the current phase in `ROADMAP.md`.
2. Add/extend types in `types/` first.
3. If it touches Chrome, add a wrapper in `browser/services` or `browser/storage`.
4. Put state in the relevant store (extend before creating a new one).
5. Build the UI in `components/popup/...`.
6. Build, verify in Chrome, update `PROJECT_STATE.md` + `CHANGELOG.md`.

## How to add a store

1. Create `stores/<name>Store.ts`.
2. Declare `State` and `Actions` interfaces, then
   `type Store = State & Actions`.
3. Use the object-returning form:
   `create<Store>((set, get) => ({ ...state, ...actions }))`
   — note the parentheses; a bare `{ }` block body returns nothing and will
   fail typecheck (this is the current `tabStore` bug).
4. Keep persistence in `browser/storage`, not in the store.
5. Add complex derived reads to `stores/selectors/`.

## How to add a search provider

1. Implement the `SearchProvider` interface in `search/providers/`.
2. Reuse `SearchableEntity` types from `search/entities/` (or add one there).
3. Register the provider in `ProviderRegistry.initialize()`.
   It is called once from `App.tsx` on mount.
4. Results flow automatically through the pipeline
   (`SearchEngine → SearchPipeline → results/`) into `searchStore`.

---

## Commit rules

- Small, focused commits; imperative subject (`fix(tab-store): ...`,
  `feat(search): ...`, `docs: ...`).
- Don't commit a red build to `main`; if recovering one, say so in the message.
- Keep generated inventories and `dist/` out of git (see `.gitignore`).
