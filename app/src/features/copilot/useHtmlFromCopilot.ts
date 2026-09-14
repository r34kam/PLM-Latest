import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchArtifactHtml, fetchCaseArtifact } from './caseArtifact'
import { findHtmlCodeBlock } from './htmlDetection'

/** How long the chat DOM must be quiet before we re-read it for a fenced block.
 *
 * This only paces the INLINE path (a ```html fence in a reply, which streams in token by
 * token). The artifact path does not use it — that one is driven by copilot status, not by
 * watching the DOM settle. */
const SETTLE_MS = 450

export type CopilotHtml = {
  /** the document itself, ready to hand to an iframe */
  html: string
  /** where it came from — a fenced code block, or a file the agent attached */
  source: 'code-block' | 'file'
  /** the file's URL, when there is one; lets the UI offer "open in a new tab" */
  url?: string
  /** the agent's own name for the file, for the panel title */
  fileName?: string
}

export type CopilotHtmlFailure = {
  url?: string
  reason: string
}

/** What the copilot reports about itself. Mirrors `useCopilotStatus()`, which cannot be
 * called here because this hook runs in the page ABOVE `<CopilotProvider>` — the page owns
 * the split layout, so it must know about the preview before the copilot mounts. The
 * copilot passes these values out instead; see `StatusBridge` in `components/copilot.tsx`. */
export type CopilotStatus = {
  isGenerating: boolean
  chatId?: string
}

type Result = {
  /** attach to the element that wraps `<CopilotChat>` — powers the fenced-block fallback */
  attachRef: (el: HTMLElement | null) => void
  /** hand to `<Copilot onStatusChange={…}>` — this is what drives the artifact path */
  onStatusChange: (status: CopilotStatus) => void
  preview: CopilotHtml | null
  failure: CopilotHtmlFailure | null
  /** true while the artifact is being resolved and fetched */
  loading: boolean
  dismiss: () => void
}

/** Surfaces whatever HTML the agent produced so the page can render it in its own iframe.
 *
 * The agent's output is a FILE recorded on the conversation record, not markup in the
 * reply, so the primary path is: copilot reports a chat → look the record up → fetch the
 * file → hand the markup to an iframe as `srcDoc`. See `caseArtifact.ts` for why it has to
 * be fetched rather than framed.
 *
 * It loads on TWO triggers, and the second one is the one that is easy to forget:
 *
 *   1. a reply finishes (`isGenerating` goes true → false), so a new artifact appears
 *      as soon as the agent is done; and
 *   2. a conversation becomes current at all — mount, reload, or picking an older chat
 *      out of the history list.
 *
 * Without (2) the preview is invisible on every page load and every conversation opened
 * from history, because those never transition out of generating. That is the normal way
 * the screen is used, so gating on (1) alone reads as "the preview never works".
 *
 * A fenced ```html block in a reply is also honoured, as a fallback that costs no network.
 */
export function useHtmlFromCopilot(): Result {
  const [preview, setPreview] = useState<CopilotHtml | null>(null)
  const [failure, setFailure] = useState<CopilotHtmlFailure | null>(null)
  const [loading, setLoading] = useState(false)

  const containerRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<MutationObserver | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** URLs already rendered. Recorded only AFTER a successful fetch, so a transient failure
   * stays retryable instead of blacklisting the artifact for the life of the page. */
  const loadedRef = useRef<Set<string>>(new Set())
  /** the exact document last committed, so an unchanged rescan does not remount the iframe */
  const lastHtmlRef = useRef<string | null>(null)
  /** set false on unmount so an in-flight fetch cannot set state afterwards */
  const aliveRef = useRef(true)

  const chatIdRef = useRef<string | undefined>(undefined)
  const wasGeneratingRef = useRef(false)
  /** aborts the in-flight load when a newer one starts or the component goes away */
  const abortRef = useRef<AbortController | null>(null)

  const commit = useCallback((next: CopilotHtml) => {
    if (!aliveRef.current) return
    if (lastHtmlRef.current === next.html) return
    lastHtmlRef.current = next.html
    setFailure(null)
    setPreview(next)
  }, [])

  /** Resolve the artifact for a conversation and render it. Safe to call repeatedly. */
  const loadArtifact = useCallback(
    async (chatId: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      /** Clear the spinner, but only if a newer load has not taken over since. */
      const stopLoading = () => {
        if (aliveRef.current && abortRef.current === controller) setLoading(false)
      }

      // The lookup runs for EVERY conversation, including the ones that never produced a
      // file, so nothing it does may open the panel. Only once it comes back with an
      // artifact do we know there is something to show — and only then does the panel get
      // a loading state to show it in.
      let artifact
      try {
        artifact = await fetchCaseArtifact(chatId, controller.signal)
      } catch (err) {
        // Reaching here means the lookup itself failed — not that the conversation has no
        // file. Reported to the console rather than the panel: an error banner on a
        // conversation that was never going to have a preview is noise, and this call is
        // made on every chat.
        if (!controller.signal.aborted) console.warn('[copilot] artifact lookup failed', err)
        stopLoading()
        return
      }

      // No file in this conversation. Leave the panel shut.
      if (!artifact || controller.signal.aborted || !aliveRef.current) {
        stopLoading()
        return
      }
      if (loadedRef.current.has(artifact.url)) {
        stopLoading()
        return
      }

      setLoading(true)
      try {
        const html = await fetchArtifactHtml(artifact.url, controller.signal)
        if (controller.signal.aborted || !aliveRef.current) return

        loadedRef.current.add(artifact.url)
        commit({ html, source: 'file', url: artifact.url, fileName: artifact.fileName })
      } catch (err) {
        if (controller.signal.aborted || !aliveRef.current) return
        // A file exists and could not be read. That IS worth the panel — it is actionable,
        // and the URL gives the user a way to open it themselves.
        setFailure({
          url: artifact.url,
          reason:
            err instanceof TypeError
              ? 'The browser blocked the request to the artifact.'
              : err instanceof Error
                ? err.message
                : String(err),
        })
      } finally {
        stopLoading()
      }
    },
    [commit],
  )

  const onStatusChange = useCallback(
    ({ isGenerating, chatId }: CopilotStatus) => {
      const previousChatId = chatIdRef.current
      const justFinished = wasGeneratingRef.current && !isGenerating
      wasGeneratingRef.current = isGenerating
      chatIdRef.current = chatId

      if (!chatId) return

      if (chatId !== previousChatId) {
        // A different conversation is on screen: drop the previous one's document so the
        // panel cannot show the old artifact next to the new chat.
        lastHtmlRef.current = null
        setPreview(null)
        setFailure(null)
        setLoading(false)
        void loadArtifact(chatId)
        return
      }

      if (justFinished) void loadArtifact(chatId)
    },
    [loadArtifact],
  )

  /** Fallback only: a reply that inlines a fenced ```html block. No network involved. */
  const scanInline = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const inline = findHtmlCodeBlock(container)
    if (inline) commit({ html: inline, source: 'code-block' })
  }, [commit])

  const attachRef = useCallback(
    (el: HTMLElement | null) => {
      containerRef.current = el
      observerRef.current?.disconnect()
      observerRef.current = null
      if (!el) return

      // One observer for the life of the element, not one per render.
      const observer = new MutationObserver(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(scanInline, SETTLE_MS)
      })
      observer.observe(el, { childList: true, subtree: true, characterData: true })
      observerRef.current = observer
      scanInline()
    },
    [scanInline],
  )

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      observerRef.current?.disconnect()
      abortRef.current?.abort()
    }
  }, [])

  const dismiss = useCallback(() => {
    setPreview(null)
    setFailure(null)
    // `lastHtmlRef` is left alone on purpose: after dismissing, the same document should
    // stay dismissed. A genuinely new artifact has different text and reopens the panel.
  }, [])

  return { attachRef, onStatusChange, preview, failure, loading, dismiss }
}
