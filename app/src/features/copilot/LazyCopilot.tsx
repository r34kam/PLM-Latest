import { lazy } from 'react'

/** The copilot entry bundles the no-code runtime and every block a reply can render —
 * roughly 2.3 MB gzipped. A static import would drag all of it into the entry chunk, so
 * every route in the app would pay for a screen most users never open.
 *
 * Declared once here so the two call sites (the Reports workspace and the Ask AI overlay)
 * share a single chunk instead of each creating their own `lazy()` wrapper. */
export const LazyCopilot = lazy(() =>
  import('@/components/copilot').then((m) => ({ default: m.Copilot })),
)
