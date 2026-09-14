/// <reference types="vite/client" />

interface ImportMetaEnv {
  // baked to "1" only in the code-builder preview build (see vite.config.ts)
  readonly VITE_SELECT_MODE?: string
  // the app's application / interface id (== the session id), injected by the
  // engine as build-time env on every build — always present
  readonly VITE_APPLICATION_ID: string
  // backend base URL, baked only into the preview build (which is served from the
  // engine's origin, so relative /api calls would miss). Unset in a deploy build,
  // where the app is same-origin with the backend.
  readonly VITE_ENTITY_API_BASE?: string
  // the app's own auth token, sent by the SDK as `x-ua-app-auth-token`. Always defined
  // (vite.config.ts), but '' outside the dev server and the preview — a deploy build
  // authenticates with the real user session instead and must not ship the secret.
  readonly VITE_APP_AUTH_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
