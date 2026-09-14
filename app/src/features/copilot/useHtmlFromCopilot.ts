import { useCallback, useEffect, useRef, useState } from 'react'
import { findHtmlCodeBlock, findHtmlLinks } from './htmlDetection'

/** How long the chat DOM must be quiet before we treat a reply as finished.
 *
 * `useCopilotStatus()` would tell us this directly, but it only works inside
 * `<CopilotProvider>` and this hook runs in the page ABOVE the provider — the page owns
 * the split layout, so it has to know about the preview before the copilot mounts.
 * Quiet-time is the honest substitute: a stream mutates the DOM continuously, so a gap
 * this long means it has stopped. */
const SETTLE_MS = 450

export type CopilotHtml = {
  /** the document itself, ready to hand to an iframe */
  html: string
  /** where it came from — a fenced code block, or a file the agent attached */
  source: 'code-block' | 'file'
  /** the file's URL, when there is one; lets the UI offer "open in a new tab" */
  url?: string
  /** human-readable artifact name; extracted from the download URL's filename segment,
   *  falling back to "HTML Preview" when absent */
  title: string
}

export type CopilotHtmlFailure = {
  url: string
  reason: string
}

type Result = {
  /** attach to the element that wraps `<CopilotChat>` */
  attachRef: (el: HTMLElement | null) => void
  preview: CopilotHtml | null
  /** a file we found but could not read — surfaced rather than swallowed */
  failure: CopilotHtmlFailure | null
  /** true while a file is being fetched from the platform */
  isFetching: boolean
  dismiss: () => void
}

/** Extract a display name from a URL's last path segment, stripping query strings. */
function titleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segment = pathname.split('/').filter(Boolean).pop() ?? ''
    const name = decodeURIComponent(segment).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim()
    return name || 'HTML Preview'
  } catch {
    return 'HTML Preview'
  }
}

/** Watches the copilot conversation for HTML the agent produced, and hands it back so the
 * page can render it in its own iframe.
 *
 * Two shapes arrive from the SDK and both are handled:
 *   1. a fenced ```html block inside a reply
 *   2. an attached `.html` file, rendered as a download link
 *
 * We render it ourselves rather than relying on the SDK's own preview because that one is
 * an iframe nested inside the platform's already-sandboxed preview frame, where it cannot
 * be granted the permissions it asks for.
 *
 * Failures are reported, never swallowed. A file artifact usually lives on a different
 * origin to the app, so a plain `fetch` can be refused by CORS — and when that happens
 * silently, the symptom is "the copilot renders no HTML files at all" with nothing in the
 * console to explain it. */
export function useHtmlFromCopilot(): Result {
  const [preview, setPreview] = useState<CopilotHtml | null>(null)
  const [failure, setFailure] = useState<CopilotHtmlFailure | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const containerRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<MutationObserver | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** URLs already fetched successfully. Failures are deliberately NOT recorded here, so a
   * transient network error can be retried when the observer next fires. */
  const fetchedRef = useRef<Set<string>>(new Set())
  /** the exact document last committed, so an unchanged rescan does not remount the iframe */
  const lastHtmlRef = useRef<string | null>(null)
  /** set false on unmount so an in-flight fetch cannot set state afterwards */
  const aliveRef = useRef(true)

  const commit = useCallback((next: CopilotHtml) => {
    if (!aliveRef.current) return
    if (lastHtmlRef.current === next.html) return
    lastHtmlRef.current = next.html
    setFailure(null)
    setIsFetching(false)
    setPreview(next)
  }, [])

  const scan = useCallback(async () => {
    const container = containerRef.current
    if (!container) return

    // A fenced block is already in the page — no network, nothing to fail.
    const inline = findHtmlCodeBlock(container)
    if (inline) commit({ html: inline, source: 'code-block', title: 'HTML Preview' })

    // Attached files are fetched newest first, so the freshest artifact wins the panel.
    const links = findHtmlLinks(container).reverse()
    for (const url of links) {
      if (fetchedRef.current.has(url)) continue
      setIsFetching(true)
      try {
        // `credentials: 'include'` because platform file URLs are session-authenticated;
        // without it the request is answered with a login page or a 403, and the panel
        // would show that instead of the document.
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) {
          if (aliveRef.current) {
            setIsFetching(false)
            setFailure({ url, reason: `The server answered ${res.status} ${res.statusText}.` })
          }
          continue
        }
        const text = await res.text()
        if (!text.trim()) {
          if (aliveRef.current) {
            setIsFetching(false)
            setFailure({ url, reason: 'The file came back empty.' })
          }
          continue
        }
        fetchedRef.current.add(url)
        // titleFromUrl extracts the filename from the download URL — the same field
        // fetchCaseDownloadUrl would return as fileName in the original flow.
        commit({ html: text, source: 'file', url, title: titleFromUrl(url) })
        return
      } catch (err) {
        // Nearly always CORS: the artifact is served from the platform's file host, which
        // is a different origin to this app. Say so instead of returning a blank panel.
        if (aliveRef.current) {
          setIsFetching(false)
          setFailure({
            url,
            reason:
              err instanceof TypeError
                ? 'The browser blocked the request, usually because the file is served from another origin.'
                : String(err),
          })
        }
      }
    }
  }, [commit])

  const attachRef = useCallback(
    (el: HTMLElement | null) => {
      containerRef.current = el
      observerRef.current?.disconnect()
      observerRef.current = null
      if (!el) return

      // One observer for the life of the element. The previous version created it in an
      // effect with no dependency array, so it was torn down and rebuilt on every render
      // of the page — including the renders its own `setState` caused.
      const observer = new MutationObserver(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => void scan(), SETTLE_MS)
      })
      observer.observe(el, { childList: true, subtree: true, characterData: true })
      observerRef.current = observer
      void scan()
    },
    [scan],
  )

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      observerRef.current?.disconnect()
    }
  }, [])

  const dismiss = useCallback(() => {
    setPreview(null)
    setFailure(null)
    setIsFetching(false)
    // `lastHtmlRef` is left alone on purpose: after dismissing, the same document should
    // stay dismissed. A genuinely new reply has different text and reopens the panel.
  }, [])

  return { attachRef, preview, failure, isFetching, dismiss }
}
