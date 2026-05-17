# `@pierre/trees` Agent Feature Library

Source parsed: [https://trees.software/docs](https://trees.software/docs)
Canonical text corpus used for extraction: [https://trees.software/trees/llms-full.txt](https://trees.software/trees/llms-full.txt)
Last parsed: 2026-04-23

## What This Library Is

`@pierre/trees` is a path-first file-tree library with:

- React runtime (`@pierre/trees/react`)
- Vanilla runtime (`@pierre/trees`)
- SSR preload/hydration runtime (`@pierre/trees/ssr`)

Core model rule:

- Canonical paths are the identity for selection, focus, search, rename, drag/drop, Git status, and annotations.

## How Agents Should Use This File

1. Find the feature section you need.
2. Apply the `Implementation` checklist exactly.
3. Use the listed APIs/options only.
4. Follow the `Notes` block to avoid common mistakes.

## Capability Map (By Feature)

| Feature | What it enables | Core APIs/options |
| --- | --- | --- |
| Choose your integration | Pick runtime and identity model | `@pierre/trees`, `@pierre/trees/react`, path-first identity |
| Get started with React | Model-first React integration | `useFileTree`, `<FileTree model={...} />`, selector hooks |
| Get started with vanilla | Imperative class runtime | `new FileTree`, `render`, `hydrate`, model methods |
| Shape data for fast rendering | Move shaping off client | `prepareFileTreeInput`, `preparePresortedFileTreeInput`, `preparedInput` |
| Navigate selection/focus/search | Interaction state and search behavior | `fileTreeSearchMode`, `useFileTreeSearch`, selection/focus getters |
| Rename/drag/item actions | Editing workflows | `renaming`, `dragAndDrop`, `composition.contextMenu` |
| Style and theme tree | Visual customization | host `className/style`, CSS vars, `themeToTreeStyles`, `density`, `unsafeCSS` |
| Customize icons | Icon sets and remaps | `icons`, `FileTreeIconConfig`, `spriteSheet` |
| Git status and annotations | Row-level status signals | `gitStatus`, `setGitStatus`, `renderRowDecoration` |
| Handle large trees | Scale and performance | `preparedInput`, `initialVisibleRowCount`, `overscan`, `density` |
| SSR guide | Server preload + client hydration flow | `preloadFileTree`, `preloadedData`, `hydrate` |
| Shared concepts | Cross-runtime contract | paths, option groups, mutation vocabulary |
| React API | Full React surface | hooks, `<FileTree />` props, model writes |
| Vanilla API | Full imperative surface | read/write methods, item handles, lifecycle |
| SSR API | SSR contract details | `preloadFileTree`, `serializeFileTreeSsrPayload`, handoff rules |
| Styling and theming | Styling reference contract | token families, fallback precedence, `themeToTreeStyles` |
| Icons | Icon reference contract | icon resolution order, `RemappedIcon`, runtime touchpoints |

---

## 1) Choose Your Integration

Docs: [choose-your-integration](https://trees.software/docs#choose-your-integration)

### Implementation

1. Treat every item identity as canonical path string.
2. If app shell is React, use `@pierre/trees/react`.
3. If app shell is non-React or imperative, use `new FileTree(...)`.
4. For anything beyond small demos, plan `preparedInput` early.

### Notes

- Do not build parallel identity systems (IDs + paths) unless absolutely required.
- `paths` is fine for tiny datasets only.

## 2) Get Started With React

Docs: [get-started-with-react](https://trees.software/docs#get-started-with-react)

### Implementation

1. Install `@pierre/trees`.
2. Create model once with `useFileTree(options)`.
3. Render with `<FileTree model={model} />`.
4. Read state with hooks (`useFileTreeSelection`, `useFileTreeSearch`, `useFileTreeSelector`).
5. Update behavior/data via model methods like `resetPaths`, `setComposition`, `setGitStatus`, `setIcons`.

### Notes

- `useFileTree` options are not a controlled-update API after mount.
- For scale, feed `preparedInput` instead of raw `paths`.
- SSR adds `preloadedData`; model-first pattern stays the same.

## 3) Get Started With Vanilla

Docs: [get-started-with-vanilla](https://trees.software/docs#get-started-with-vanilla)

### Implementation

1. Construct model with `new FileTree(options)`.
2. Mount with `render({ fileTreeContainer })` or `render({ containerWrapper })`.
3. Use model methods for all reads/writes (`getSelectedPaths`, `focusPath`, `setSearch`, etc.).
4. Update config incrementally via `resetPaths`, `setComposition`, `setGitStatus`, `setIcons`.
5. Use `hydrate({ fileTreeContainer })` when SSR markup exists.

### Notes

- Do not scrape DOM for source-of-truth state.
- If wrapping in another framework, keep the `FileTree` instance lifecycle explicit.

## 4) Shape Tree Data For Fast Rendering

Docs: [shape-tree-data-for-fast-rendering](https://trees.software/docs#shape-tree-data-for-fast-rendering)

### Implementation

1. Gather canonical paths outside UI boundary.
2. Use `prepareFileTreeInput(paths, options?)` for general prepared input.
3. Use `preparePresortedFileTreeInput(paths)` when server already owns final ordering.
4. Pass `preparedInput` to React, vanilla, or SSR preload.

### Notes

- Presorted prepared input is the highest-performance path.
- Keep client-side shaping/sorting as fallback, not default.

## 5) Navigate Selection, Focus, And Search

Docs: [navigate-selection-focus-and-search](https://trees.software/docs#navigate-selection-focus-and-search)

### Implementation

1. Enable search with `search: true`.
2. Choose search behavior via `fileTreeSearchMode`.
3. Default to `'hide-non-matches'` unless product requires broader context.
4. Read selection/focus/search from model APIs or React selector hooks.
5. Drive search via `setSearch` or `useFileTreeSearch(...).setValue(...)`.

### Notes

- Selection and focus are related but not interchangeable.
- Keyboard navigation follows visible tree state (expansion/search directly affect focus movement).
- Search does not change identity model; paths remain canonical truth.

## 6) Rename, Drag, And Trigger Item Actions

Docs: [rename-drag-and-trigger-item-actions](https://trees.software/docs#rename-drag-and-trigger-item-actions)

### Implementation

1. Enable renaming with `renaming` and guards (`canRename`, `onRename`, `onError`).
2. Enable drag/drop with `dragAndDrop` hooks (`canDrag`, `canDrop`, `onDropComplete`, `onDropError`).
3. Add optional context menu via composition surface (`renderContextMenu` in React, `composition.contextMenu.render` in vanilla).
4. Persist rename/move in app layer (server/store), not inside tree internals.

### Notes

- Keep rename + drag workflows usable without requiring context menu.
- Preserve focus predictability for keyboard users when menus open/close.

## 7) Style And Theme The Tree

Docs: [style-and-theme-the-tree](https://trees.software/docs#style-and-theme-the-tree)

### Implementation

1. Style host panel first (`className`/`style` in React, host element in vanilla).
2. Apply internal appearance via CSS variables.
3. Use `themeToTreeStyles(theme)` to map VS Code/Shiki-like themes.
4. Set spacing/row profile via `density` (`'compact' | 'default' | 'relaxed'` or numeric factor).
5. Use `itemHeight` only for non-preset row heights.
6. Use `unsafeCSS` only for narrow unsupported cases.

### Notes

- Fallback chain: explicit overrides -> `--trees-theme-*` -> defaults.
- Density affects `--trees-item-height` and `--trees-density-override`; caller inline values still override.

## 8) Customize Icons

Docs: [customize-icons](https://trees.software/docs#customize-icons)

### Implementation

1. Start with built-in set: `'minimal'`, `'standard'`, or `'complete'`.
2. If needed, switch to object config and set `colored: false` for quieter look.
3. Use `byFileName` for exact basename remaps.
4. Use `byFileNameContains` for substring-rule remaps.
5. Use `byFileExtension` for suffix-rule remaps (supports multi-part like `spec.ts`).
6. Use `spriteSheet` with `<symbol>` definitions for branded/custom icons.

### Notes

- Precedence: basename exact -> basename contains -> extension specificity -> built-in set -> generic fallback.
- Do not replace the full icon system if a few remaps solve the need.

## 9) Show Git Status And Row Annotations

Docs: [show-git-status-and-row-annotations](https://trees.software/docs#show-git-status-and-row-annotations)

### Implementation

1. Use `gitStatus` for Git-like state.
2. Supported statuses: `added`, `modified`, `deleted`, `ignored`, `renamed`, `untracked`.
3. Update over time with `setGitStatus(next)` and clear with `setGitStatus(undefined)`.
4. Use `renderRowDecoration` for non-Git metadata (generated, remote, validation, etc.).
5. Combine both if row needs Git signal + product-specific marker.

### Notes

- Do not encode non-Git concepts as fake Git statuses.
- Keep annotation meaning separate from styling implementation.

## 10) Handle Large Trees Efficiently

Docs: [handle-large-trees-efficiently](https://trees.software/docs#handle-large-trees-efficiently)

### Implementation

1. Prefer `preparedInput` for large trees.
2. Prefer `preparePresortedFileTreeInput` if backend already sorts.
3. Ensure host has real CSS height.
4. Tune first render via `initialVisibleRowCount`.
5. Tune density via `density` (or `itemHeight` when preset mismatch).
6. Tune scroll smoothness/work tradeoff via `overscan`.
7. Keep expansion/search costs in mind when many rows become visible.

### Notes

- Do not start with virtualization micro-tuning before fixing input preparation.
- Avoid rebuilding model if `resetPaths(...)` is enough.

## 11) SSR (Guide)

Docs: [ssr](https://trees.software/docs#ssr)

### Implementation

1. On server, call `preloadFileTree(options)` from `@pierre/trees/ssr`.
2. Treat returned payload as opaque handoff object.
3. React: create model with `useFileTree(...)`, pass payload as `<FileTree preloadedData={payload} />`.
4. Vanilla: create model with matching options, call `hydrate({ fileTreeContainer })` on server-rendered host.
5. Keep server and client tree-defining options aligned.

### Notes

- SSR is a preload/hydration layer, not a third identity/runtime model.
- `initialVisibleRowCount` is only pre-measurement hint; steady-state height is layout-driven.

## 12) Shared Concepts

Docs: [shared-concepts](https://trees.software/docs#shared-concepts)

### Implementation Contract

- Identity: canonical path strings.
- Input shapes: `paths`, `preparedInput`, presorted prepared input.
- Search modes: `hide-non-matches`, `collapse-non-matches`, `expand-matches`.
- Editing surfaces: `dragAndDrop`, `renaming`, `composition`.
- Appearance surfaces: `gitStatus`, `icons`, `renderRowDecoration`, `unsafeCSS`.
- Rendering knobs: `initialVisibleRowCount`, `density`, `itemHeight`, `overscan`.
- Mutation vocabulary: `add`, `remove`, `move`, `batch`, `resetPaths`, `onMutation`.

### Notes

- Keep SSR payload opaque.
- Keep docs/integrations path-first and runtime-agnostic by default.

## 13) React API (Reference)

Docs: [react-api](https://trees.software/docs#react-api)

### Core Surface

- `useFileTree(options)` -> `{ model }`
- `<FileTree model={model} />`
- React-only composition props on `<FileTree />`: `header`, `renderContextMenu`, `preloadedData`

### Selector Hooks

- `useFileTreeSelector(model, selector, equality?)`
- `useFileTreeSelection(model)`
- `useFileTreeSearch(model)` snapshot fields: `isOpen`, `matchingPaths`, `value`
- `useFileTreeSearch(model)` actions: `open`, `close`, `setValue`, `focusNextMatch`, `focusPreviousMatch`

### Notes

- React is a thin wrapper over the same imperative model.
- Write operations still go through model methods.

## 14) Vanilla API (Reference)

Docs: [vanilla-api](https://trees.software/docs#vanilla-api)

### Lifecycle

- Constructor: `new FileTree(options)`
- Mount: `render({ fileTreeContainer })` or `render({ containerWrapper })`
- Hydrate: `hydrate({ fileTreeContainer })`
- Teardown: `unmount()`, `cleanUp()`
- Host lookup: `getFileTreeContainer()`

### Read APIs

- `getItem(path)`
- `getFocusedItem()` / `getFocusedPath()`
- `getSelectedPaths()`
- `getComposition()`
- `isSearchOpen()` / `getSearchValue()` / `getSearchMatchingPaths()`

### Item Handle APIs

- Shared: `getPath`, `focus`, `select`, `toggleSelect`, `deselect`
- Directory-only: `expand`, `collapse`, `toggle`

### Write/Control APIs

- Focus/selection: `focusPath`, `focusNearestPath`, `startRenaming`
- Search: `setSearch`, `openSearch`, `closeSearch`, `focusNextSearchMatch`, `focusPreviousSearchMatch`
- Data/mutations: `add`, `remove`, `move`, `batch`, `resetPaths`, `onMutation`
- Reconfiguration: `setComposition`, `setGitStatus`, `setIcons`
- Subscription: `subscribe(listener)`

## 15) SSR API (Reference)

Docs: [ssr-api](https://trees.software/docs#ssr-api)

### Core APIs

- `preloadFileTree(options)`
- `serializeFileTreeSsrPayload(payload, mode?)`
- Payload type name: `FileTreeSsrPayload` (treat payload as opaque contract)

### Handoff Rules

Server/client must match:

- data source (`paths` vs prepared input form)
- `id`
- expansion/search-affecting options
- appearance-affecting options that alter initial output

### Notes

- Mismatched contracts produce hydration issues.
- React consumes payload as `preloadedData`; vanilla hydrates existing markup.

## 16) Styling And Theming (Reference)

Docs: [styling-and-theming](https://trees.software/docs#styling-and-theming)

### Core Contract

- Host styling for container/frame/layout.
- CSS-variable families for tree internals.
- Fallback precedence: explicit overrides -> `--trees-theme-*` -> defaults.
- Theme mapping helper: `themeToTreeStyles(theme)`.
- Escape hatch: `unsafeCSS` (narrow use only).

### `themeToTreeStyles` Types

- Input: `TreeThemeInput` (`type`, `bg`, `fg`, `colors`)
- Output: `TreeThemeStyles` (usable in React inline styles or vanilla host styling)

## 17) Icons (Reference)

Docs: [icons](https://trees.software/docs#icons)

### Core Contract

- Set-only mode: `icons: 'minimal' | 'standard' | 'complete'`
- Config mode: `FileTreeIconConfig`
- Config keys include `set?: 'minimal' | 'standard' | 'complete' | 'none'`, `colored?: boolean`, `spriteSheet?: string`, `remap?: Record<string, RemappedIcon>`, `byFileName?`, `byFileNameContains?`, and `byFileExtension?`.

### Resolution Order

1. `byFileName` exact
2. `byFileNameContains`
3. `byFileExtension` (most specific suffix first)
4. built-in set mapping
5. generic file remap/fallback

### `RemappedIcon`

- string symbol id, or
- object: `{ name, width?, height?, viewBox? }`

---

## Practical Agent Recipes

### A) Build a scalable searchable tree (React)

1. Server-load canonical paths.
2. `preparePresortedFileTreeInput` if order already known; otherwise `prepareFileTreeInput`.
3. `useFileTree({ preparedInput, search: true, fileTreeSearchMode: 'hide-non-matches' })`.
4. Bind search input with `useFileTreeSearch(model)`.
5. Render `<FileTree model={model} className=... style=... />`.

### B) Add rename + drag with persistence (vanilla)

1. Enable `renaming` + `dragAndDrop` guards.
2. Persist in `onRename` and `onDropComplete`.
3. Surface failures via `onError`/`onDropError`.
4. Keep model as source of truth; never infer via DOM.

### C) SSR-hydrate a large tree safely

1. Server: `preloadFileTree` with prepared input and stable `id`.
2. Send opaque payload unchanged.
3. Client React: matching `useFileTree` options + `<FileTree preloadedData={payload} />`.
4. Client vanilla: matching `new FileTree(...)` + `hydrate(...)`.
5. Do not mutate tree-defining options between preload and hydration.

## Non-Negotiable Rules For Agents

- Treat path strings as the canonical item identity.
- Prefer prepared input for non-trivial datasets.
- Keep model-first architecture across React, vanilla, and SSR.
- Use `density` before `itemHeight` unless preset row heights do not fit.
- Keep `unsafeCSS` and sprite-sheet customization as exception paths.
- Keep SSR payload opaque.
