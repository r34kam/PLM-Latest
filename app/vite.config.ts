import { transformSync } from '@babel/core'
import type { IncomingMessage } from 'node:http'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite'

// The code-builder preview is built with VITE_SELECT_MODE=1 (see _start_preview
// in sessions.py). Only then do we stamp elements for the visual select/edit
// overlay — a real deploy build runs without the flag and stays completely clean.
const SELECT_MODE = process.env.VITE_SELECT_MODE === '1'

const SRC_DIR = path.resolve(__dirname, 'src')

// Babel visitor: stamp every JSX element with data-sel-id="<file>:<line>:<col>"
// so the parent (www) can map a clicked DOM node back to a stable identity.
// babel AST nodes are untyped here
function stampSelectionIds({ types: t }: { types: any }) {
  return {
    name: 'stamp-selection-ids',
    visitor: {
      JSXOpeningElement(elementPath: any, state: any) {
        const node = elementPath.node
        if (!node.loc) return // generated nodes
        const already = node.attributes.some(
          (attr: any) => attr.type === 'JSXAttribute' && attr.name?.name === 'data-sel-id',
        )
        if (already) return
        const filename: string = state.filename ?? ''
        const rel = path.relative(SRC_DIR, filename).split(path.sep).join('/')
        const { line, column } = node.loc.start
        // Insert as the FIRST attribute (fallback), NOT the last. A shadcn-style
        // primitive spreads `{...props}` onto its root (`<span {...props}/>`), and the
        // call site's data-sel-id rides in via props. If our stamp came AFTER that
        // spread it would OVERRIDE the call-site id, so the DOM node would carry the
        // ui-primitive's own id (e.g. ui/badge.tsx:…) instead of the call site
        // (Badges.tsx:…) — which is what the extractor's tree uses, so a preview click
        // would report an id absent from the tree and select/scroll nothing. Stamping
        // first makes a propagated data-sel-id win, keeping the DOM id == the tree id.
        node.attributes.unshift(
          t.jsxAttribute(
            t.jsxIdentifier('data-sel-id'),
            t.stringLiteral(`${rel}:${line}:${column}`),
          ),
        )
      },
    },
  }
}

// @vitejs/plugin-react v6 (rolldown/oxc) does NOT run user babel plugins — it
// compiles JSX with oxc. So we run our own syntax-only babel pass as an
// enforce:'pre' transform (JSX preserved) to stamp elements before oxc handles
// them. Active only in the VITE_SELECT_MODE preview build.
function selectionStampPlugin(): Plugin {
  return {
    name: 'ua-selection-stamp',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0]
      if (!file.startsWith(SRC_DIR) || !/\.[jt]sx$/.test(file)) return null
      const result = transformSync(code, {
        filename: file,
        babelrc: false,
        configFile: false,
        // parse only — keep JSX + TS in the output for oxc to compile
        parserOpts: { plugins: ['jsx', 'typescript'] },
        plugins: [stampSelectionIds],
        sourceMaps: true,
      })
      if (!result?.code) return null
      return { code: result.code, map: result.map }
    },
  }
}

// Where `bun run dev` forwards /api and /auth. The engine records it in the app's .env at
// build time (_ensure_api_proxy_env in sessions.py). No default on purpose: a dev server
// aimed at the wrong backend is worse than no proxy, so unset registers none.
function apiProxyTarget(mode: string): string {
  // prefix '' is what makes a non-VITE_ key visible; only this one key is read out, so it
  // never joins clientEnv and never reaches the browser
  return (loadEnv(mode, __dirname, '').API_PROXY_TARGET ?? '').trim()
}

// The 401 handling below mirrors www/apps/tensor/src/authGate.ts so dev lands on the same
// /login?returnTo=<path> the deployed app does. Different mechanism though: tensor gates the
// document request (it knows the interface's authMode), while here only /api and /auth are
// proxied, so an API 401 is the only signal available.
const LOGIN_PATH = '/login'

// mirrors REDIRECT_TO_KEY in www/apps/tensor/src/platformConstants.ts — keep in sync
// (that repo has platformConstants.drift.test.ts guarding the same value)
const REDIRECT_TO_KEY = 'returnTo'

// the SDK's 401 recovery posts here and navigates to wherever it redirects
// (LOGOUT_URL_WITH_PERSIST_PATH in src/@unifyapps/app-builder-sdk/fetch-*.js). On anything
// that is NOT a redirect it instead falls back to reloading the current page, which is why
// three dev-only shims below have to line up for a 401 to reach /login at all — delete any
// one and the app silently reload-loops on the route it started from:
//   1. platformProxy's proxyReq Origin rewrite  — so the platform 303s instead of 403ing
//   2. platformProxy's proxyRes 3xx branch      — so that 303 stays on the dev origin
//   3. spaFallbackForFetchPlugin's Accept shim  — so the followed /login GET is a 2xx
// Deployed, none are needed: app and platform share an origin and tensor serves index.html.
const LOGOUT_PATH = '/auth/logout'

// Public auth routes the app serves itself: a 401 raised while already on one must not bounce
// to /login, or returnTo nests forever. Mirrors tensor's AUTH_PATHS — including its omission
// of /update-password, which requires a session and so stays gated.
const AUTH_PATHS = new Set([
  '/login',
  '/mfa-verification',
  '/signup',
  '/forgot-password',
  '/reset-password',
])

// Only an origin-relative path may become returnTo: '//host' and '/\host' read as
// protocol-relative to whatever consumes it, sending the login redirect off-origin.
function sameOriginPath(page: string | undefined): string | null {
  if (!page?.startsWith('/')) return null
  if (page.startsWith('//') || page.startsWith('/\\')) return null
  return page
}

// The app route the 401 happened on. A proxied navigation IS that route; an XHR only carries
// it in Referer — and unlike tensor's gate, which reads its own request url, Referer is
// attacker-settable, so a foreign origin must not get to choose where login sends the user.
// null when undeterminable: no returnTo beats a wrong one.
function pageLocation(req: IncomingMessage, isNavigation: boolean): string | null {
  if (isNavigation) return sameOriginPath(req.url)
  const referer = req.headers.referer
  if (!referer) return null
  try {
    const url = new URL(referer)
    if (!req.headers.host || url.host !== req.headers.host) return null
    return sameOriginPath(`${url.pathname}${url.search}`)
  } catch {
    return null
  }
}

// returnTo carries only the path, never a full url (same rule as tensor's loginRedirect).
function loginRedirect(page: string | null): string {
  if (!page) return LOGIN_PATH
  const params = new URLSearchParams({ [REDIRECT_TO_KEY]: page })
  return `${LOGIN_PATH}?${params}`
}

// Stage 3 of the LOGOUT_PATH chain. Vite's html fallback only answers requests that Accept
// text/html, but the SDK's logout hop is a fetch() — it follows the redirect to /login with
// the API request's Accept, 404s, and ky throws, so postLogoutAndRedirect's catch reloads the
// CURRENT page instead. Serving the shell keeps that 2xx. Deployed, tensor answers every
// non-asset route with index.html.
function spaFallbackForFetchPlugin(): Plugin {
  return {
    name: 'ua-spa-fallback-for-fetch',
    apply: 'serve',
    configureServer(server) {
      // added here (not in a post hook) so it runs before Vite's own html middleware
      server.middlewares.use((req, _res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        const wantsHtml = (req.headers.accept ?? '').includes('text/html')
        if (req.method === 'GET' && !wantsHtml && AUTH_PATHS.has(pathname)) {
          req.headers.accept = 'text/html'
        }
        next()
      })
    },
  }
}

// A definitive 401 routes to /login; every other status passes through untouched, matching
// isSessionValid's rule that only a 401 means expired — a platform blip locks nobody out.
function platformProxy(target: string): ProxyOptions {
  // Parsed once here, not per request; a malformed API_PROXY_TARGET fails at config load.
  const targetOrigin = new URL(target).origin

  return {
    target,
    changeOrigin: true,
    // rewrite: (path) => path.replace(/^\/api/, ''),
    configure: (proxy) => {
      // Stage 1 of the LOGOUT_PATH chain. `changeOrigin` rewrites Host but leaves Origin as
      // the dev server's, and the platform CSRF-checks Origin against its own host — a browser
      // attaches `Origin: http://localhost:5173` to every non-GET (curl attaches none, so this
      // reproduces only in the app), which 403s the logout hop. Rewritten rather than stripped:
      // upstream reads an absent Origin as a non-browser caller, and same-origin browser is
      // what dev is emulating. Only the forwarded request is touched, so req.headers keeps the
      // browser's real Referer that pageLocation() reads to build returnTo. Vite's own
      // rewriteOriginHeader does exactly this but is wired to WebSocket upgrades only; its
      // declarative `headers` option is not a substitute, as it would fabricate an Origin on
      // requests that never carried one.
      proxy.on('proxyReq', (proxyReq) => {
        if (proxyReq.getHeader('origin')) proxyReq.setHeader('origin', targetOrigin)
      })

      // Mutating proxyRes here is picked up by http-proxy's own writeStatusCode /
      // writeHeaders passes, which run after this event — no selfHandleResponse needed.
      proxy.on('proxyRes', (proxyRes, req) => {
        const status = proxyRes.statusCode ?? 0
        const accept = req.headers.accept ?? ''
        const isNavigation =
          req.headers['sec-fetch-mode'] === 'navigate' || accept.includes('text/html')
        const page = pageLocation(req, isNavigation)

        // Stage 2 of the LOGOUT_PATH chain. Deployed, app and platform share an origin so the
        // recovery hop lands on the app's own login. In dev the platform may answer with its
        // OWN origin, which fetch() rejects on CORS, so rewrite that hop onto this one.
        // Logout only: an SSO begin-login 3xx must still reach the identity provider.
        if (status >= 300 && status < 400 && (req.url ?? '').startsWith(LOGOUT_PATH)) {
          const location = proxyRes.headers.location
          if (!location) return
          let target: URL
          try {
            target = new URL(location, `http://${req.headers.host ?? 'localhost'}`)
          } catch {
            return
          }
          if (req.headers.host && target.host === req.headers.host) return // already local
          // the platform sends its root when it has no page to persist, so only trust the
          // target when it really is an auth route (then it carries its own returnTo)
          proxyRes.headers.location = AUTH_PATHS.has(target.pathname)
            ? `${target.pathname}${target.search}`
            : loginRedirect(page)
          return
        }

        if (status !== 401) return

        // the login page's own calls (sign-in, mfa) 401 by design — redirecting them
        // would nest returnTo
        if (page && AUTH_PATHS.has(page.split('?')[0])) return

        const target = loginRedirect(page)

        // Only a navigation may be answered with a 3xx. fetch/XHR follow redirects
        // transparently, so a 302 would hand the caller index.html as a 200 and blow up
        // parsing it as JSON — they keep their 401 and get the destination in a header.
        if (!isNavigation) {
          proxyRes.headers['x-auth-redirect'] = target
          return
        }

        proxyRes.statusCode = 302
        proxyRes.statusMessage = 'Found' // else the upstream's "Unauthorized" phrase rides along
        proxyRes.headers.location = target
        // the upstream 401 body still streams in; browsers ignore a 302 body, but a stale
        // content-length/type would describe it wrongly.
        delete proxyRes.headers['content-length']
        delete proxyRes.headers['content-type']
      })
    },
  }
}

// Build-time-only knobs the engine passes in the environment (see sessions.py). VITE_-prefixed
// so loadEnv picks them up, but they must not reach the browser: VITE_OUT_DIR is an absolute
// build-machine path and would be inlined at every process.env reference site.
const BUILD_ONLY_ENV = new Set(['VITE_OUT_DIR', 'VITE_APP_BASE', 'VITE_SELECT_MODE'])

// The app's own credential (`x-ua-app-auth-token`), recorded unprefixed in app/.env by
// _ensure_dev_env. Unprefixed is the whole point: it keeps Vite from inlining the secret
// into EVERY build, so exposing it stays an explicit decision made right here — and only
// for the two ways an app runs OUTSIDE deployment, where it has no user session of its own:
// the dev server (`command === 'serve'`) and the engine-hosted preview (VITE_IS_PREVIEW=1,
// which _deploy_build_env pops). A deploy build matches neither, so the published bundle
// never contains the token.
function appAuthToken(mode: string, command: string): string {
  const isDeployBuild = command !== 'serve' && process.env.VITE_IS_PREVIEW !== '1'
  if (isDeployBuild) return ''
  // prefix '' to read a non-VITE_ key, exactly as apiProxyTarget does
  return (loadEnv(mode, __dirname, '').APP_AUTH_TOKEN ?? '').trim()
}

export default defineConfig(({ command, mode }) => {
  // Never widen this prefix: loadEnv('') would inline every server-side secret in
  // process.env into the client bundle.
  const clientEnv = Object.fromEntries(
    Object.entries(loadEnv(mode, __dirname, 'VITE_')).filter(([k]) => !BUILD_ONLY_ENV.has(k)),
  )

  // Only dev is 'development'; anything else (--mode staging) is a production-style build, and
  // saying otherwise ships React's and the SDK's dev-only paths.
  const nodeEnv = mode === 'development' ? 'development' : 'production'

  // The vendored SDK (Next.js-derived) reads process.env both dotted and dynamically
  // (process.env[`${svc}_..._HOST`] in fetch-*.js), so the define has to be a real object —
  // a bare `{}` resolves EVERY lookup, NODE_ENV included, to undefined, flipping every
  // `NODE_ENV !== 'production'` guard on inside a production bundle. The explicit NODE_ENV
  // entry wins where both could match (most specific define). Keep the parens: `process.env`
  // in statement position would otherwise emit a bare `{...}` block and fail to parse.
  const processEnv = { NODE_ENV: nodeEnv, ...clientEnv }

  const authToken = appAuthToken(mode, command)
  const proxyTarget = apiProxyTarget(mode)
  // dev only — server.proxy does not exist in a build, so there is nothing to warn about
  if (command === 'serve' && !proxyTarget) {
    console.warn(
      '[vite] API_PROXY_TARGET is not set in app/.env — /api and /auth are NOT proxied, so' +
        ' the SDK\'s calls will 404 against the dev server.',
    )
  }

  return {
    // An engine-hosted build is served from an absolute subpath (the live preview, a
    // historical version), which the engine bakes in as VITE_APP_BASE at build time
    // (_run_preview_build / _version_build_env in sessions.py). Absolute makes index.html
    // reference assets absolutely, so deep links load the JS/CSS at ANY depth — a relative
    // base resolves './assets/…' against the deep-linked directory and 404s below the first
    // level. It is also where App.tsx's router basename comes from (read back as BASE_URL).
    // A deploy build bakes VITE_APP_BASE='/' — the app's domain root, absolute so a
    // deep-link refresh resolves assets there too, not the relative dir. The './'
    // fallback only covers a bare `bun run build` with no engine env (local/standalone).
    base: process.env.VITE_APP_BASE || './',
    build: {
      // Preview builds write the default `dist/`. A deploy/publish build overrides this to
      // `deployed/dist` (VITE_OUT_DIR, set by the engine's _run_deploy_build) so the
      // published bundle lands in app/deployed/dist and NEVER overwrites the live preview at
      // app/dist — the preview keeps serving throughout a publish (no flash).
      outDir: process.env.VITE_OUT_DIR || 'dist',
    },
    plugins: [
      react(),
      tailwindcss(),
      spaFallbackForFetchPlugin(),
      ...(SELECT_MODE ? [selectionStampPlugin()] : []),
    ],
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      'process.env': `(${JSON.stringify(processEnv)})`,
      // Always defined, so main.tsx can read it unconditionally — a deploy build gets the
      // empty string, which the SDK treats as "no token" and sends no header. Defining it
      // to `undefined` instead would leave the identifier unreplaced in some positions.
      'import.meta.env.VITE_APP_AUTH_TOKEN': JSON.stringify(authToken),
    },
    server: {
      ...(proxyTarget
        ? {
            proxy: {
              '/api': platformProxy(proxyTarget),
              '/auth': platformProxy(proxyTarget),
            },
          }
        : {}),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
