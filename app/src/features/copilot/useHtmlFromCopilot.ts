import { useCallback, useEffect, useRef, useState } from 'react'
import type { CopilotStatus } from '@/components/copilot'

// How long to wait after isGenerating flips false before calling /api/lookup.
// The case entity write is async server-side; the artifact URL is not present at the
// exact moment generation ends.
const LOOKUP_DELAY_MS = 1500

// Selector for anchor elements whose href points at a platform file download.
// Clicks on these are intercepted so they open our preview panel instead of navigating.
const ARTIFACT_LINK_SELECTOR = 'a[href*="/api/file/download/"]'

// --- Types ---

export type CopilotHtml = {
  /** the document itself, ready to hand to an iframe */
  html: string
  /** where it came from; always "file" in the lookup flow */
  source: 'file'
  /** the download URL; lets the UI offer "open in a new tab" */
  url: string
  /** human-readable artifact name from the case entity's fileName field */
  title: string
}

export type CopilotHtmlFailure = {
  /** the download URL that failed, for the "open in a new tab" link */
  url: string
  reason: string
}

type Result = {
  /** attach to the element that wraps CopilotChat to intercept artifact link clicks */
  attachRef: (el: HTMLElement | null) => void
  preview: CopilotHtml | null
  failure: CopilotHtmlFailure | null
  isFetching: boolean
  handleStatusChange: (status: CopilotStatus) => void
  dismiss: () => void
}

// --- Helpers ---

type LookupResult = { downloadUrl: string; fileName: string } | null

async function fetchCaseDownloadUrl(chatId: string): Promise<LookupResult> {
  const res = await fetch('/api/lookup', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      lookupType: 'ENTITY_ID:service_hub_case',
      keys: [chatId],
      type: 'ByKeys',
    }),
  })
  if (!res.ok) throw new Error(`Lookup failed: ${res.status} ${res.statusText}`)
  const body = await res.json()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const props: Record<string, any> =
    body?.objects?.[chatId]?.properties?.additional?.lastPreviewDetails?.canvas?.props ?? {}
  const downloadUrl = typeof props.downloadUrl === 'string' ? props.downloadUrl : null
  const fileName = typeof props.fileName === 'string' ? props.fileName : null
  if (!downloadUrl) return null
  return { downloadUrl, fileName: fileName || fallbackTitle(downloadUrl) }
}

function fallbackTitle(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const segment = pathname.split('/').filter(Boolean).pop() ?? ''
    return decodeURIComponent(segment).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim() || 'HTML Preview'
  } catch {
    return 'HTML Preview'
  }
}

// --- Hook ---

export function useHtmlFromCopilot(): Result {
  const [preview, setPreview] = useState<CopilotHtml | null>(null)
  const [failure, setFailure] = useState<CopilotHtmlFailure | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  const aliveRef = useRef(true)
  const seenUrlsRef = useRef(new Set<string>())
  const wasGeneratingRef = useRef(false)
  const prevChatIdRef = useRef<string | null>(null)
  const chatIdRef = useRef<string | null>(null)
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current)
    }
  }, [])

  const loadArtifact = useCallback(
    async (chatId: string, opts?: { forceUrl?: string; forceTitle?: string }) => {
      if (!aliveRef.current) return

      let downloadUrl: string
      let fileName: string

      if (opts?.forceUrl) {
        // Click path: the href is already the download URL; skip the lookup.
        downloadUrl = opts.forceUrl
        fileName = opts.forceTitle || fallbackTitle(opts.forceUrl)
      } else {
        // Status path: look up the artifact URL from the case entity.
        let lookupResult: LookupResult
        try {
          setIsFetching(true)
          lookupResult = await fetchCaseDownloadUrl(chatId)
        } catch (err) {
          if (!aliveRef.current) return
          setIsFetching(false)
          setFailure({ url: '', reason: err instanceof Error ? err.message : String(err) })
          return
        }
        if (!lookupResult) {
          if (aliveRef.current) setIsFetching(false)
          return
        }
        downloadUrl = lookupResult.downloadUrl
        fileName = lookupResult.fileName
      }

      // Skip if we already have this document in the panel.
      // The click handler deletes the URL from seenUrls before calling us, so a
      // dismissed panel can always be re-opened by clicking the artifact link.
      if (seenUrlsRef.current.has(downloadUrl)) {
        if (aliveRef.current) setIsFetching(false)
        return
      }

      setIsFetching(true)

      let text: string
      try {
        const res = await fetch(downloadUrl, { credentials: 'include' })
        if (!res.ok) {
          if (!aliveRef.current) return
          setIsFetching(false)
          setFailure({ url: downloadUrl, reason: `Server responded ${res.status} ${res.statusText}.` })
          return
        }
        text = await res.text()
      } catch (err) {
        if (!aliveRef.current) return
        setIsFetching(false)
        setFailure({
          url: downloadUrl,
          reason: err instanceof TypeError
            ? 'The browser blocked the request (likely a CORS or network error).'
            : String(err),
        })
        return
      }

      if (!text.trim()) {
        if (!aliveRef.current) return
        setIsFetching(false)
        setFailure({ url: downloadUrl, reason: 'The file came back empty.' })
        return
      }

      if (!aliveRef.current) return
      seenUrlsRef.current.add(downloadUrl)
      setFailure(null)
      setIsFetching(false)
      setPreview({ html: text, source: 'file', url: downloadUrl, title: fileName })
    },
    [],
  )

  const handleStatusChange = useCallback(
    ({ isGenerating, chatId }: CopilotStatus) => {
      const justFinished = wasGeneratingRef.current && !isGenerating
      const chatIdChanged = chatId !== null && chatId !== prevChatIdRef.current

      wasGeneratingRef.current = isGenerating
      prevChatIdRef.current = chatId
      chatIdRef.current = chatId

      if (!chatId) return

      if (justFinished) {
        // Delay lookup: case entity write is async; artifact URL not present immediately.
        if (delayTimerRef.current) clearTimeout(delayTimerRef.current)
        delayTimerRef.current = setTimeout(() => void loadArtifact(chatId), LOOKUP_DELAY_MS)
        return
      }

      if (chatIdChanged) {
        // Page reload or history navigation: artifact already written, look up immediately.
        void loadArtifact(chatId)
      }
    },
    [loadArtifact],
  )

  // Attach to the CopilotChat wrapper element. Intercepts clicks on artifact download
  // links, prevents navigation to the attachment URL (which serves an empty document
  // because the browser honours Content-Disposition: attachment), and loads the
  // artifact bytes into our preview panel instead.
  //
  // This is not DOM scraping: we read no text from the DOM. We only intercept
  // user-initiated click events on links the SDK has already rendered.
  const attachRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return

      const handleClick = (e: MouseEvent) => {
        const anchor = (e.target as HTMLElement).closest(ARTIFACT_LINK_SELECTOR) as HTMLAnchorElement | null
        if (!anchor) return

        const href = anchor.href || anchor.getAttribute('href') || ''
        if (!href.includes('/api/file/download/')) return

        e.preventDefault()
        e.stopPropagation()

        const currentChatId = chatIdRef.current
        if (!currentChatId) return

        // Remove from seen so a dismissed preview can be re-opened.
        seenUrlsRef.current.delete(href)
        setIsFetching(true)
        void loadArtifact(currentChatId, { forceUrl: href })
      }

      el.addEventListener('click', handleClick, { capture: true })
      // Return a cleanup that useCallback cannot return -- wire it via useEffect instead.
      // For simplicity, store it so attachRef callers can clean up by calling with null.
      ;(el as HTMLElement & { _artifactClickCleanup?: () => void })._artifactClickCleanup =
        () => el.removeEventListener('click', handleClick, { capture: true })
    },
    [loadArtifact],
  )

  // Separate cleanup effect: React fires the ref callback with null on unmount, but
  // useCallback refs do not support returning a cleanup function. We store the cleanup
  // on the element and call it via a stable wrapper.
  const stableAttachRef = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return
      attachRef(el)
      return () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cleanup = (el as any)._artifactClickCleanup
        if (typeof cleanup === 'function') cleanup()
      }
    },
    [attachRef],
  )

  const dismiss = useCallback(() => {
    setPreview(null)
    setFailure(null)
    setIsFetching(false)
  }, [])

  return { attachRef: stableAttachRef, preview, failure, isFetching, handleStatusChange, dismiss }
}
