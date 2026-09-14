# App

A Vite + React app. This exact stack is what the **runner** serves natively — no
Dockerfile, no custom server, no build adapter. Building the app produces a static
`dist/`, and the runner hosts it.

## Quick start

Requires [Bun](https://bun.sh) (the package manager and script runner for this project;
npm/pnpm/yarn are not used).

```bash
bun install       # install dependencies
bun run dev       # Vite dev server with HMR
```

Then open the URL Vite prints (`http://localhost:5173` by default).

### Backend calls in dev

The app talks to the platform over same-origin `/api` and `/auth`. In
development there is no platform on `localhost`, so the dev server proxies those paths
to a real backend. The target is read from `API_PROXY_TARGET` in `.env`:

```dotenv
API_PROXY_TARGET=https://<your-platform-host>
```

`API_PROXY_TARGET` has no `VITE_` prefix on purpose — it is read only by
`vite.config.ts` and never reaches the browser bundle.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Dev server, HMR, `/api` + `/auth` proxy |
| `bun run build` | Typecheck (`tsc -b`) then production bundle into `dist/` |
| `bun run preview` | Serve the built `dist/` locally |
| `bun run lint` | oxlint (`correctness` rules as errors) |
| `bun test` | Bun's test runner over `src/**/*.test.ts(x)` |

`bun run build` is the deployment build — it must pass before publishing, since it is
also the typecheck gate.

## Tech stack

| Area | Choice |
| --- | --- |
| UI framework | React 19 |
| Language | TypeScript 7 (native `tsc`, `tsc -b` typecheck) |
| Build tool | Vite 8 + `@vitejs/plugin-react` v6 (Oxc-based JSX transform) |
| Package manager / runtime | Bun (install, scripts, test runner) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`, `tw-animate-css` |
| Components | shadcn (`radix-nova` style) on Radix UI primitives, in `src/components/ui` |
| Icons | lucide-react |
| Routing | react-router-dom 7, `BrowserRouter` (clean URLs) |
| Server state | TanStack Query (mounted by `AppBuilderProvider`) |
| Client state | Zustand |
| Charts | Recharts |
| Toasts / command menu / theming | sonner, cmdk, next-themes |
| Utilities | clsx, tailwind-merge, class-variance-authority, date-fns |
| Linting | oxlint |
| Platform SDK | `@unifyapps/app-builder-sdk` (vendored at `src/@unifyapps/`) |

## Project layout

```
src/
  main.tsx                 root providers (AppBuilderProvider, tooltips, toasts)
  App.tsx                  routes
  index.css                Tailwind entry + design tokens
  routes/                  page components (Login, ForgotPassword, UpdatePassword, …)
  components/ui/           shadcn primitives
  data/                    ALL data hooks — components import from '@/data'
  lib/                     utils, helpers
  @unifyapps/              vendored platform SDK (do not edit)
public/                    static assets copied verbatim
```

Path aliases: `@/*` → `src/*`, and `@unifyapps/app-builder-sdk` → the vendored copy.
Both are configured in `tsconfig.app.json` and `vite.config.ts`.

### Platform SDK

`@unifyapps/app-builder-sdk` is vendored (a prebuilt drop-in for the private npm
package) so the app builds with no registry access. It provides:

- `AppBuilderProvider` — mounts TanStack Query and resolves the interface; already wired
  in `main.tsx`.
- `hooks/object` — entity CRUD (`useSearchEntities`, `useFindEntityById`, `useCreateEntity`,
  `useUpdateEntity`, `useDeleteEntity`, …).
- `hooks/workflow` — trigger and execute workflows.
- `hooks/auth`, `hooks/user` — login, logout, SSO, user context.
- `hooks/upload` — `useUppy`, the only supported way to upload a file. It stores the file
  and returns a URL to persist; the provider is already mounted and boots lazily on first
  use. See the `file-upload` skill.

Wrap these in `src/data/` rather than calling them from components (`useUppy` is the
exception — it belongs in the upload component itself, next to the file input).

## Environment variables

Only `VITE_`-prefixed keys reach the browser. Anything you add to `.env` **overrides**
what the builder injects, and `.env` values may reference injected env with `${VAR}`.

| Variable | Set by | Purpose |
| --- | --- | --- |
| `API_PROXY_TARGET` | build / you | Dev-server proxy target for `/api` and `/auth`. Dev only |
| `VITE_APPLICATION_ID` | build | Interface id the SDK resolves the app against |
| `VITE_ENTITY_API_BASE` | build | Backend origin, when the bundle is not same-origin with the platform |
| `VITE_APP_BASE` | build | Vite `base`; also the router basename. `/` for a deployed build |
| `VITE_OUT_DIR` | build | Overrides the output directory |
| `VITE_SELECT_MODE` | build | Preview only — visual select/edit bridge. Never set in a deploy build |
| `VITE_IS_PREVIEW` | build | Preview only — the bundle runs inside the authed builder |

`VITE_OUT_DIR`, `VITE_APP_BASE` and `VITE_SELECT_MODE` are build-machine values and are
deliberately stripped before the client env is inlined.

## Deployment

The runner supports this stack natively. Publishing does the whole thing:

1. Runs `bun run build` with `VITE_APP_BASE=/` and no preview flags — a clean bundle
   rooted at the app's domain.
2. The runner serves the resulting `dist/` statically, answering every unmatched route
   with `index.html`, so `BrowserRouter` deep links and hard refreshes
   work at any depth.
3. `/api` and `/auth` are same-origin in production, so the SDK's relative calls need no
   proxy — the dev proxy exists only to reproduce that locally.

Nothing else is required: no server process, no serverless adapter, no runtime
configuration. Any host that serves a static directory and rewrites unmatched routes to
`index.html` will also work (a `vercel.json` with the same contract ships in the repo).

### Engine-owned files

These are managed by the builder and re-synced; edits to them may be overwritten:

- `vite.config.ts` — base path, proxy, preview instrumentation
- `src/main.tsx` — root providers and build-flag wiring
- `src/@unifyapps/` — the vendored SDK

Do not start a long-lived dev server or install packages from inside a builder session —
the preview is produced by `bun run build` and served by the platform.
