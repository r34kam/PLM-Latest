You are an expert in TypeScript, React 19, Vite, React Router, Tailwind CSS v4, and shadcn/ui.

Project Layout
- Import app code through the `@/` alias (= `app/src/`); avoid deep relative paths.
- Pages go in `src/routes/` (PascalCase file, default export, `function` declaration — match `Login.tsx`). Shared components go in `src/components/` with named exports. Data hooks live in `src/data/`; utilities and stores in `src/lib/`. Directory names are lowercase-dashed.
- `src/main.tsx` and `vite.config.ts` are engine-owned — never edit them. Keep the `APPLICATION_ID`/basename block in `App.tsx` intact when editing routes. Engine-supplied env (e.g. `VITE_APPLICATION_ID`) is injected at build time — read via `import.meta.env.VITE_*`; your own env vars go in a normal `app/.env`, and a key defined there overrides the engine's value.
- Private npm registries: auth goes in `app/.npmrc` as `//<registry-host>/:_authToken=${TOKEN_ENV_NAME}` — env var name only, never a literal token (platform env resolves it at install and build time).

TypeScript
- Functional, declarative code; no classes. Use the `function` keyword for components and pure helpers.
- Type props inline or with `type` aliases; interfaces are fine for object shapes — just be consistent.
- Never use `enum` — the build rejects it (`erasableSyntaxOnly`); use `as const` objects and union types.

State and Data
- Dynamic data comes through hooks: `useData` from `@/lib/data`, or the app's data hooks in `@/data`. Never call fetch/axios in a component and never fetch inside `useEffect`.
- `useData`'s `data` is already the unpacked records array (`undefined` while loading/on error). Never re-unwrap it — `extractRecords`/`extractPage`/`extractRecord` from `@/data/bindings` take the RAW `useExecuteWorkflowNode*` envelope, and running one over a `useData` result throws `no response.objects` at run time.
- Shared client state: a zustand store in `src/lib/store.ts` — UI state (dialogs, filters, selection) only, not server data.
- Derive, don't sync: compute values from props/state during render; `useMemo` only when genuinely expensive; never mirror props into state.
- `useEffect` is for external systems (DOM, subscriptions, timers) — not for data flow you can express in render or event handlers.
- Navigate with react-router `<Link>`/`useNavigate` using route paths; never hardcode absolute URLs (the preview is served under a subpath).

UI and Styling
- Tailwind + the shadcn components in `app/src/components/ui` for all UI; merge conditional classes with `cn()` from `@/lib/utils`. You may restyle the ui primitives, but keep their exported APIs stable.
- No inline styles and no raw hex/rgb: colors only via theme tokens from `src/index.css` (`bg-background`, `text-muted-foreground`, `var(--chart-1..5)` for recharts). Dark mode is the `.dark` class.
- Icons: lucide-react. Toasts: `toast()` from sonner (`<Toaster>` already mounted). Dates: date-fns.

Copilot (UnifyApps AI agent chat)
- The copilot is assembled from parts, never imported whole: `CopilotProvider` (the runtime), `CopilotChat` (the conversation), `CopilotHistory` (past conversations), `CopilotNewChatButton`, plus the `useCopilotActions()` and `useCopilotStatus()` hooks — all from `@unifyapps/app-builder-sdk/copilot`. `src/components/copilot.tsx` is the app's own composition; edit it freely (layout, chrome, which parts appear). Do NOT import the SDK's prebuilt `<Copilot />` — it is compiled into the bundle and cannot be restyled or rearranged.
- Everything copilot-related must render inside `<CopilotProvider>`; the parts and hooks reach the chat by id through the store it creates and throw outside it. One `<CopilotChat>` per provider — for two copilots on a screen, use two providers with different `instanceId`.
- History and "New chat" are composition, not configuration. There is no `history` prop: place `<CopilotHistory />` and `<CopilotNewChatButton />` (or call `newChat()` from `useCopilotActions`) wherever the layout wants them. Selecting a conversation switches the chat on its own — wire no callbacks.
- Drive your own chrome with the hooks: `useCopilotStatus()` gives `isGenerating` / `chatId` (swap send for stop mid-stream), `useCopilotActions()` gives `sendMessage`, `stopResponse`, `newChat`, `goToChat`. The actions no-op until `<CopilotChat>` has mounted.
- Light/dark: pass `colorScheme` (`'light'` | `'dark'` | `'system'`) to `CopilotProvider` — it drives the design-system tokens and the Joy theme together, scoped to the copilot's own root. The copilot does not read the app's theme by itself, so a dark app that omits this renders a light copilot; bind it to the app's theme state or pass `'system'`.
- Give the chat a bounded height and keep a `min-h-0` chain down to `CopilotHistory`, or the list grows and the page scrolls instead of the list. Import `@unifyapps/app-builder-sdk/copilot.css` once, where the copilot is composed.
- `src/components/copilot.tsx` ships unreferenced — no route imports it, so an app that never asks for a copilot bundles none of it. When the app does need one, add the route yourself and import the component **lazily** (`lazy()` + `Suspense`): it pulls the no-code runtime and every renderable block, ~2.3 MB gzipped, and a static import drags all of that into the entry chunk for every page.

Clean Code
- Prefer guard clauses and early returns over nested conditionals.
- Every data-driven view handles loading → error → empty → data (use `Skeleton`; design real empty states, never a blank div).
- Keep components small and single-purpose: hooks own data, presentational children receive props. Split any component mixing fetching, layout, and interaction logic.
- No magic numbers or strings — hoist named constants (UPPER_SNAKE) for limits, keys, durations, statuses.
- Don't drill props past ~2 levels; restructure with composition (children/slots) or context.
- Extract repeated logic into a custom `useXxx` hook and repeated markup into a component — but only on the ~3rd repetition; a wrong abstraction costs more than duplication.
- Name for intent: booleans `isX`/`hasX`/`canX`, handlers `handleX`, callback props `onX`.
- Accessibility: semantic elements (`button`, `nav`, `label` — never a clickable `div`), label every input, `alt` on every image, visible keyboard focus.
- Delete dead code, commented-out blocks, and debug logs as you go.
