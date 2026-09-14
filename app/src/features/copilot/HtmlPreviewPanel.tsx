import { useCallback, useRef, useState } from 'react'
import { ExternalLink, Maximize2, Minimize2, TriangleAlert, X } from 'lucide-react'
import type { CopilotHtml, CopilotHtmlFailure } from './useHtmlFromCopilot'

/* What the iframe is allowed to do.
 *
 * Only `allow-scripts` — `allow-same-origin` is deliberately absent. Paired with
 * `allow-scripts` it hands the framed document the app's own origin, letting it reach
 * back out through `window.parent` — a live injection surface on production tenants.
 * Without it the document gets an opaque origin; scripts still run, the sandbox still
 * works, and LLM-generated artifacts already wrap any storage access in try blocks. */
const SANDBOX = 'allow-scripts'

const MIN_WIDTH = 320
const DEFAULT_WIDTH_FRACTION = 0.5

type Props = {
  preview: CopilotHtml | null
  failure: CopilotHtmlFailure | null
  isFetching: boolean
  onClose: () => void
}

/** Drag handle — sits on the left edge of the panel and lets the user resize it. */
function ResizeHandle({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true
    lastX.current = e.clientX
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return
      const dx = lastX.current - e.clientX // negative clientX delta = panel grows
      lastX.current = e.clientX
      onDrag(dx)
    },
    [onDrag],
  )

  const stopDrag = useCallback(() => {
    dragging.current = false
  }, [])

  return (
    <div
      role="separator"
      aria-label="Resize preview panel"
      aria-orientation="vertical"
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: 'col-resize',
        zIndex: 10,
        // Subtle visual affordance on hover
        background: 'transparent',
        transition: 'background 0.15s',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      data-test-id="html-preview-resize-handle"
    />
  )
}

/** Renders whatever HTML the agent produced, or explains why it could not.
 *
 * Canvas-style chrome: artifact title on the left, fullscreen toggle + close on the
 * right, drag-to-resize from the left edge, and explicit loading / error states so the
 * panel is never silent about what it is doing. */
export function HtmlPreviewPanel({ preview, failure, isFetching, onClose }: Props) {
  // Pixel width of the panel; updated by the drag handle.
  const [panelWidth, setPanelWidth] = useState<number | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Resolve the display title — prefer the artifact's own name, fall back gracefully.
  const title = preview?.title ?? (failure ? 'Attachment error' : isFetching ? 'Loading…' : 'HTML Preview')

  const handleDrag = useCallback(
    (dx: number) => {
      setPanelWidth((prev) => {
        const current = prev ?? window.innerWidth * DEFAULT_WIDTH_FRACTION
        return Math.max(MIN_WIDTH, current + dx)
      })
    },
    [],
  )

  // Nothing to show and nothing loading — stay invisible.
  if (!preview && !failure && !isFetching) return null

  const resolvedWidth = isFullscreen
    ? '100%'
    : panelWidth != null
    ? `${panelWidth}px`
    : `${DEFAULT_WIDTH_FRACTION * 100}%`

  return (
    <div
      data-test-id="html-preview-panel"
      style={{
        position: isFullscreen ? 'absolute' : 'relative',
        inset: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 20 : undefined,
        width: resolvedWidth,
        minWidth: isFullscreen ? undefined : MIN_WIDTH,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        background: 'var(--background)',
        flexShrink: 0,
      }}
    >
      {/* Drag handle — left edge, full height */}
      {!isFullscreen && <ResizeHandle onDrag={handleDrag} />}

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        {/* Artifact title */}
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          data-test-id="html-preview-title"
          title={title}
        >
          {title}
        </span>

        {/* Fullscreen toggle */}
        <button
          type="button"
          className="iconbtn"
          onClick={() => setIsFullscreen((f) => !f)}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Expand to full width'}
          data-test-id="html-preview-fullscreen-btn"
        >
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>

        {/* Close */}
        <button
          type="button"
          className="iconbtn"
          onClick={onClose}
          aria-label="Close preview"
          title="Close preview"
          data-test-id="html-preview-close-btn"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Body ───────────────────────────────────────────────────── */}

      {/* Loading state */}
      {isFetching && !preview && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            color: 'var(--muted-foreground)',
          }}
          data-test-id="html-preview-loading"
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: '2px solid var(--border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
            aria-hidden="true"
          />
          <span style={{ fontSize: 13 }}>Loading preview…</span>
        </div>
      )}

      {/* Error state */}
      {failure && !preview && (
        <div
          style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}
          data-test-id="html-preview-error"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
            <TriangleAlert size={15} />
            Couldn't load the attached file
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
            {failure.reason}
          </p>
          <a
            href={failure.url}
            target="_blank"
            rel="noreferrer noopener"
            data-test-id="html-preview-open-external"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
          >
            <ExternalLink size={13} />
            Open in a new tab
          </a>
        </div>
      )}

      {/* Preview iframe */}
      {preview && (
        <iframe
          // Keying on the document forces a fresh frame per revision. Mutating srcDoc in
          // place would leave the old document's timers and listeners running underneath.
          key={preview.html.length + ':' + preview.html.slice(0, 64)}
          data-test-id="html-preview-iframe"
          srcDoc={preview.html}
          sandbox={SANDBOX}
          referrerPolicy="no-referrer"
          style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
          title={preview.title}
        />
      )}

      {/* Keyframe for the loading spinner — injected inline to avoid a separate CSS file */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
