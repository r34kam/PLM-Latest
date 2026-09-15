import { useCallback, useEffect, useRef, useState } from 'react'
import { cardIndexForClick } from './artifactCards'
import { type CaseArtifact, fetchArtifactHtml, fetchConversationArtifacts } from './caseArtifact'
import { findHtmlCodeBlock } from './htmlDetection'

/** How long the chat DOM must be quiet before we re-read it for a fenced block.
 *
 * This only paces the INLINE path (a ```html fence in a reply, which streams in token by
 * token). The artifact path is driven by copilot status and by clicks, not by watching the
 * DOM settle. */
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
 * the split layout, so it must know about the conversation before the copilot mounts. The
 * copilot passes these values out instead; see `StatusBridge` in `components/copilot.tsx`. */
export type CopilotStatus = {
  isGenerating: boolean
  chatId?: string
}

type Result = {
  /** attach to the element that wraps `<CopilotChat>` — powers clicks and the inline fallback */
  attachRef: (el: HTMLElement | null) => void
  /** hand to `<Copilot onStatusChange={…}>` — this is what drives the artifact path */
  onStatusChange: (status: CopilotStatus) => void
  preview: CopilotHtml | null
  failure: CopilotHtmlFailure | null
  /** true while an artifact is being fetched */
  loading: boolean
  /** every HTML file in the conversation, oldest first */
  artifacts: CaseArtifact[]
  /** which one the panel is showing, or -1 */
  activeIndex: number
  /** show a particular artifact — backs both the card clicks and the panel's own switcher */
  open: (index: number) => void
  dismiss: () => void
}

/** Surfaces the HTML the agent produced so the page can render it in its own iframe.
 *
 * The agent's output is a FILE, not markup in the reply, so the primary path is: copilot
 * reports a conversation → list its artifacts → fetch one → hand the markup to an iframe as
 * `srcDoc`. See `caseArtifact.ts` for why it must be fetched rather than framed.
 *
 * Every artifact in the conversation is listed, not just the latest, so clicking an older
 * file card opens that file. Clicks are matched to artifacts by order — see
 * `artifactCards.ts` for why identity is not available.
 *
 * The list refreshes on TWO triggers, and the second is the one that is easy to forget:
 *
 *   1. a reply finishes (`isGenerating` goes true → false), so a new file appears as soon
 *      as the agent is done; and
 *   2. a conversation becomes current at all — mount, reload, or picking an older chat out
 *      of the history list.
 *
 * Without (2) the preview is invisible on every page load and every conversation opened
 * from history, because those never transition out of generating. That is the normal way
 * the screen is used, so gating on (1) alone reads as "the preview never works".
 */
export function useHtmlFromCopilot(aiAgentId: string): Result {
  const [preview, setPreview] = useState<CopilotHtml | null>(null)
  const [failure, setFailure] = useState<CopilotHtmlFailure | null>(null)
  const [loading, setLoading] = useState(false)
  const [artifacts, setArtifacts] = useState<CaseArtifact[]>([])
  const [activeIndex, setActiveIndex] = useState(-1)

  const containerRef = useRef<HTMLElement | null>(null)
  const observerRef = useRef<MutationObserver | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clickHandlerRef = useRef<((e: Event) => void) | null>(null)
  /** the exact document last committed, so an unchanged rescan does not remount the iframe */
  const lastHtmlRef = useRef<string | null>(null)
  /** set false on unmount so an in-flight fetch cannot set state afterwards */
  const aliveRef = useRef(true)

  const artifactsRef = useRef<CaseArtifact[]>([])
  /** mirrors `activeIndex` so callbacks can read it without listing it as a dependency */
  const activeIndexRef = useRef(-1)
  const chatIdRef = useRef<string | undefined>(undefined)
  const wasGeneratingRef = useRef(false)
  /** the user closed the panel; don't reopen it behind their back on a routine refresh */
  const dismissedRef = useRef(false)
  /** aborts the in-flight document fetch when a newer one starts */
  const fetchAbortRef = useRef<AbortController | null>(null)
  /** aborts the in-flight artifact listing */
  const listAbortRef = useRef<AbortController | null>(null)

  /** Fetch one artifact's markup and show it. */
  const show = useCallback(async (index: number, list: CaseArtifact[]) => {
    const artifact = list[index]
    if (!artifact) return

    fetchAbortRef.current?.abort()
    const controller = new AbortController()
    fetchAbortRef.current = controller

    dismissedRef.current = false
    activeIndexRef.current = index
    setActiveIndex(index)
    setFailure(null)
    setLoading(true)
    try {
      const html = await fetchArtifactHtml(artifact.url, controller.signal)
      if (controller.signal.aborted || !aliveRef.current) return
      lastHtmlRef.current = html
      setPreview({ html, source: 'file', url: artifact.url, fileName: artifact.fileName })
    } catch (err) {
      if (controller.signal.aborted || !aliveRef.current) return
      // A file exists and could not be read. That IS worth the panel — it is actionable,
      // and the URL gives the user a way to open it themselves.
      setPreview(null)
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
      if (aliveRef.current && fetchAbortRef.current === controller) setLoading(false)
    }
  }, [])

  /** Re-read the conversation's artifact list. `autoOpen` shows the newest one. */
  const refresh = useCallback(
    async (chatId: string, autoOpen: boolean) => {
      listAbortRef.current?.abort()
      const controller = new AbortController()
      listAbortRef.current = controller

      let list: CaseArtifact[]
      try {
        list = await fetchConversationArtifacts(chatId, aiAgentId, controller.signal)
      } catch (err) {
        // The listing runs for EVERY conversation, including ones that never produced a
        // file, so a failure here must not put an error banner on screen. Console only.
        if (!controller.signal.aborted) console.warn('[copilot] artifact listing failed', err)
        return
      }
      if (controller.signal.aborted || !aliveRef.current) return

      const previous = artifactsRef.current
      artifactsRef.current = list
      setArtifacts(list)

      // Nothing in this conversation — leave the panel shut.
      if (!list.length) return

      // Open the newest only when it is genuinely new, so a routine refresh cannot yank
      // the panel off an older file the user deliberately opened.
      const isNew = list.length > previous.length
      if (autoOpen && !dismissedRef.current && (isNew || activeIndexRef.current === -1)) {
        void show(list.length - 1, list)
      }
    },
    [aiAgentId, show],
  )

  const open = useCallback(
    (index: number) => {
      void show(index, artifactsRef.current)
    },
    [show],
  )

  const onStatusChange = useCallback(
    ({ isGenerating, chatId }: CopilotStatus) => {
      const previousChatId = chatIdRef.current
      const justFinished = wasGeneratingRef.current && !isGenerating
      wasGeneratingRef.current = isGenerating
      chatIdRef.current = chatId

      if (!chatId) return

      if (chatId !== previousChatId) {
        // A different conversation is on screen: drop the previous one entirely so the
        // panel cannot show the old file beside the new chat.
        lastHtmlRef.current = null
        artifactsRef.current = []
        dismissedRef.current = false
        activeIndexRef.current = -1
        setArtifacts([])
        setActiveIndex(-1)
        setPreview(null)
        setFailure(null)
        setLoading(false)
        void refresh(chatId, true)
        return
      }

      if (justFinished) void refresh(chatId, true)
    },
    [refresh],
  )

  /** Fallback only: a reply that inlines a fenced ```html block. No network involved. */
  const scanInline = useCallback(() => {
    const container = containerRef.current
    if (!container || dismissedRef.current) return
    const inline = findHtmlCodeBlock(container)
    if (!inline || lastHtmlRef.current === inline) return
    lastHtmlRef.current = inline
    setFailure(null)
    setPreview({ html: inline, source: 'code-block' })
  }, [])

  const attachRef = useCallback(
    (el: HTMLElement | null) => {
      const previous = containerRef.current
      if (previous && clickHandlerRef.current) {
        previous.removeEventListener('click', clickHandlerRef.current)
      }
      observerRef.current?.disconnect()
      observerRef.current = null
      clickHandlerRef.current = null
      containerRef.current = el
      if (!el) return

      // Clicking a file card opens that file. The card carries no URL, so the click is
      // matched to an artifact by position — see `artifactCards.ts`.
      const onClick = (event: Event) => {
        const index = cardIndexForClick(el, event.target as Element | null)
        if (index < 0) return
        const list = artifactsRef.current
        if (index >= list.length) return
        open(index)
      }
      el.addEventListener('click', onClick)
      clickHandlerRef.current = onClick

      // One observer for the life of the element, not one per render.
      const observer = new MutationObserver(() => {
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(scanInline, SETTLE_MS)
      })
      observer.observe(el, { childList: true, subtree: true, characterData: true })
      observerRef.current = observer
      scanInline()
    },
    [open, scanInline],
  )

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
      observerRef.current?.disconnect()
      fetchAbortRef.current?.abort()
      listAbortRef.current?.abort()
      const container = containerRef.current
      if (container && clickHandlerRef.current) {
        container.removeEventListener('click', clickHandlerRef.current)
      }
    }
  }, [])

  const dismiss = useCallback(() => {
    dismissedRef.current = true
    setPreview(null)
    setFailure(null)
    setLoading(false)
    setActiveIndex(-1)
    // `lastHtmlRef` is left alone on purpose: after dismissing, the same document should
    // stay dismissed. Clicking a card reopens it explicitly.
  }, [])

  return { attachRef, onStatusChange, preview, failure, loading, artifacts, activeIndex, open, dismiss }
}
