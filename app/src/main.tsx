import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppBuilderProvider } from '@unifyapps/app-builder-sdk'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'

// Code-builder preview only: load the visual select/edit bridge. The flag is
// baked in by the preview build (VITE_SELECT_MODE=1); a real deploy build drops
// this branch entirely, so the bridge is tree-shaken out and never ships.
if (import.meta.env.VITE_SELECT_MODE === '1') {
  void import('@/lib/selectionBridge').then((m) => m.initSelectionBridge())
}

// Preview builds are served from the ENGINE's origin, so the SDK's relative
// /api calls need the backend's base URL. The engine bakes it in at preview
// build time (VITE_ENTITY_API_BASE, from PLATFORM_ENTITY_API_BASE); unset
// (prod: deploy build, same-origin with the backend) keeps relative /api.
const entityApiBase = import.meta.env.VITE_ENTITY_API_BASE || undefined

// The app's application / interface id — the APP id, stable across every chat about this
// app (NOT a session id). AppBuilderProvider uses it to resolve the interface and its PUBLIC/PRIVATE
// `security.type` (which decides whether the app needs sign-in). Injected by the
// engine as build-time env — never compute or hardcode it (a `.env` entry may
// override or reference it).
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID

// Engine-served preview build vs tensor-served (deployed) app. The preview build
// bakes VITE_IS_PREVIEW=1; a deploy build leaves it unset, so this is false there.
// Preview runs inside the builder's authed session, so the SDK skips public/authed
// routing (`isPublicInterface`) when true. Engine-owned — agents must NOT change it.
const IS_PREVIEW = import.meta.env.VITE_IS_PREVIEW === '1'

// The app's own credential, sent by the SDK on every call as `x-ua-app-auth-token`. Only
// the ways of running the app OUTSIDE deployment carry one — the dev server and the
// engine-hosted preview — because neither has an end-user session of the app's own. A
// deploy build resolves this to '' (see appAuthToken in vite.config.ts): the published app
// is same-origin with the platform and authenticates with the real session, so the SDK
// sends no header at all. Engine-owned — agents must NOT change it.
const APP_AUTH_TOKEN = import.meta.env.VITE_APP_AUTH_TOKEN || undefined

// Root providers live here, not in App.tsx — the builder owns App.tsx (routes)
// and would otherwise have to re-add these every time. Tooltips and toasts
// (sonner) work anywhere in the tree without per-app wiring. AppBuilderProvider
// mounts TanStack Query so the @unifyapps/app-builder-sdk data hooks work anywhere
// below it (see the unifyapps-sdk skill); it's inert if the app does no backend CRUD.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppBuilderProvider
      appAuthToken={APP_AUTH_TOKEN}
      baseUrl={entityApiBase}
      interfaceId={APPLICATION_ID}
      isPreview={IS_PREVIEW}
    >
      <TooltipProvider>
        <App />
        <Toaster />
      </TooltipProvider>
    </AppBuilderProvider>
  </StrictMode>,
)
