import { useCallback, useEffect, useRef, useState } from 'react'
import type { CopilotStatus } from '@/components/copilot'

// ── Types ──────────────────────────────────────────────────────────────────

export type CopilotHtml = {
  /** the document itself, ready to hand to an iframe */
  html: string
  /** where it came from — always 'file' in the lookup flow */
  source: 'file'
  /** the download URL; lets the UI offer "open in a new tab" */
  url: string
  /** human-readable artifact name from the case entity's `fileName` field,
   *  falling back to "HTML Preview" when absent */
  title: string
}

export type CopilotHtmlFailure = {
  /** the download URL that failed, for the "open in a new tab" link */
  url: string
  reason: string
}

type Result = {
  preview: CopilotHtml | null
  /** a file we tried to load but could not — surfaced rather than swallowed */
  failure: CopilotHtmlFailure | null
  /** true while the lookup or file fetch is in flight */
  isFetching: boolean
  /** stable callback — pass this as `onStatusChange` to `<LazyCopilot>` */
  handleStatusChange: (status: CopilotStatus) => void
  dismiss: () => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type LookupResult = { downloadUrl: string; fileName: string } | null

/** POST /api/lookup to read the latest preview artifact from the case entity.
 *
 * The case object (`service_hub_case`) stores the last thing the agent produced in:
 *   properties.additional.lastPreviewDetails.canvas.props.downloadUrl
 *   properties.additional.lastPreviewDetails.canvas.props.fileName
 *
 * We reach it by entity id (the chat id), which is the case id on this platform. */
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

  if (!res.ok) {
    throw new Error(`Lookup failed: ${res.status} ${res.statusText}`)
  }

  const body = await res.json()
  const props: Record<string, unknown> =
    (body?.objects?.[chatId]?.properties?.additional?.lastPreviewDetails?.canvas?.props) ?? {}

  const downloadUrl = typeof props.downloadUrl === 'string' ? props.downloadUrl : null
  const fileName = typeof props.fileName === 'string' ? props.fileName : null

  if (!downloadUrl) return null
  return {
    downloadUrl,
    // Fall back to a sanitised version of the URL path when the entity has no fileName.
    fileName: fileName || fallbackTitle(downloadUrl),
  }
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

// ── Hook ─────────────────────────────────────────────────────────────────────

/** Resolves HTML artifact previews through the case entity API rather than by scraping
 * the chat DOM.
 *
 * The artifact is delivered as a file attachment whose URL serves
 * `Content-Disposition: attachment`. An `<iframe src>` navigating to it gets an empty
 * document (the browser honours the disposition). `fetch()` ignores it, so we retrieve
 * the bytes and inject them via `srcDoc`.
 *
 * Lookup is triggered:
 *   - when chatId first becomes available or switches (page reload / history navigation)
 *   - when `isGenerating` transitions true → false (generation just finished)
 *
 * A URL is recorded as seen only after a successful fetch, so a transient network error
 * does not permanently suppress the preview. */
export function useHtmlFromCopilot(): Result {
  const [preview, setPreview] = useState<CopilotHtml | null>(null)
  const [failure, setFailure] = useState<CopilotHtmlFailure | null>(null)
  const [isFetching, setIsFetching] = useState(false)

  /** guard: do not call setState after unmount */
  const aliveRef = useRef(true)
  /** URLs whose file content was successfully fetched and committed. A URL is added AFTER
   * a successful fetch so a transient failure does not blacklist it permanently. */
  const seenUrlsRef = useRef(new Set<string>())
  /** Track the previous isGenerating value so we detect the true → false edge. */
  const wasGeneratingRef = useRef(false)
  /** Track the previous chatId so we detect a switch. */
  const prevChatIdRef = useRef<string | null>(null)

  // Stored in a ref so the effect closure always sees the latest without re-creating.
  const previewRef = useRef<CopilotHtml | null>(null)
  previewRef.current = preview

  useEffect(() => {
    aliveRef.current = true
    return () => { aliveRef.current = false }
  }, [])

  /** Run the full lookup → fetch → commit pipeline for a given chatId. */
  const loadArtifact = useCallback(async (chatId: string) => {
    let lookupResult: LookupResult
    try {
      setIsFetching(true)
      lookupResult = await fetchCaseDownloadUrl(chatId)
    } catch (err) {
      if (!aliveRef.current) return
      setIsFetching(false)
      // Surface lookup errors — a blank panel is the worst possible failure mode.
      setFailure({
        url: '',
        reason: err instanceof Error ? err.message : String(err),
      })
      return
    }

    if (!lookupResult) {
      // No artifact on this case yet — nothing to show, clear fetching state.
      if (aliveRef.current) setIsFetching(false)
      return
    }

    const { downloadUrl, fileName } = lookupResult

    // Skip if we already have this document committed to the panel.
    if (seenUrlsRef.current.has(downloadUrl)) {
      if (aliveRef.current) setIsFetching(false)
      return
    }

    // Fetch the actual HTML bytes.
    // `credentials: 'include'` because the download URL is session-authenticated; a plain
    // request gets a login redirect or a 403 instead of the document.
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
    // Mark seen AFTER a successful fetch so transient failures can be retried.
    seenUrlsRef.current.add(downloadUrl)
    setFailure(null)
    setIsFetching(false)
    setPreview({ html: text, source: 'file', url: downloadUrl, title: fileName })
  }, [])

  /** Stable callback — wired to `onStatusChange` on `<LazyCopilot>`. Fires inside the
   * provider (from StatusBridge) so useCopilotStatus() values are always up-to-date. */
  const handleStatusChange = useCallback(
    ({ isGenerating, chatId }: CopilotStatus) => {
      const justFinished = wasGeneratingRef.current && !isGenerating
      const chatIdChanged = chatId !== null && chatId !== prevChatIdRef.current

      wasGeneratingRef.current = isGenerating
      prevChatIdRef.current = chatId

      // Trigger lookup when generation finishes OR when the chatId first arrives / changes.
      // The chatId-change path handles page reload and history navigation without requiring
      // a new generation to complete.
      if (chatId && (justFinished || chatIdChanged)) {
        void loadArtifact(chatId)
      }
    },
    [loadArtifact],
  )

  const dismiss = useCallback(() => {
    setPreview(null)
    setFailure(null)
    setIsFetching(false)
    // seenUrlsRef is intentionally NOT cleared: the same URL dismissed by the user should
    // stay dismissed. A genuinely new artifact will have a different URL.
  }, [])

  return { preview, failure, isFetching, handleStatusChange, dismiss }
}
