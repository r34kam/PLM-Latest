import { ExternalLink, Loader2, TriangleAlert, X } from 'lucide-react'
import type { CopilotHtml, CopilotHtmlFailure } from './useHtmlFromCopilot'

/* What the framed document is allowed to do.
 *
 * `allow-same-origin` is deliberately ABSENT. Paired with `allow-scripts` it hands the
 * framed document this app's own origin, so an agent-written page could read the session
 * and reach back out through `parent`. The browser treats that pair as an escape from the
 * sandbox rather than a use of it. Without it the document gets an opaque origin, and
 * storage access throws — which the generated reports already expect and guard for.
 *
 * The other three are not decoration. Each was measured failing SILENTLY under bare
 * `allow-scripts`, which is the trap: nothing throws and nothing reaches the console, so a
 * dashboard looks fine and simply does not work.
 *
 *   allow-forms      — without it the `submit` event is never DISPATCHED, so a form's
 *                      handler never runs at all.
 *   allow-downloads  — without it `a[download]` is dropped and `a.click()` does NOT throw,
 *                      so an export button reports success and produces no file.
 *   allow-modals     — without it `window.confirm()` returns false without prompting, so
 *                      anything behind an "are you sure?" silently takes the cancel path.
 *
 * `allow-popups` and `allow-top-navigation` are deliberately NOT here: they are escapes,
 * not capabilities, and none of them grant anything the page could not already reach with
 * `allow-scripts` alone. */
const SANDBOX = 'allow-scripts allow-forms allow-downloads allow-modals'

type Props = {
  preview: CopilotHtml | null
  failure: CopilotHtmlFailure | null
  loading: boolean
  onClose: () => void
}

function PanelShell({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode
  title: string
  onClose: () => void
}) {
  return (
    <div
      data-test-id="html-preview-panel"
      style={{
        width: '50%',
        minWidth: 320,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        background: 'var(--background)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}
      >
        <span
          style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={title}
        >
          {title}
        </span>
        <button
          type="button"
          className="iconbtn"
          onClick={onClose}
          data-test-id="html-preview-close-btn"
          title="Close preview"
          aria-label="Close preview"
        >
          <X size={14} />
        </button>
      </div>
      {children}
    </div>
  )
}

/** Renders whatever HTML the agent produced, or says why it could not.
 *
 * The failure and loading branches matter as much as the success one. An earlier version
 * caught fetch errors into an empty block, so a failed artifact produced no preview, no
 * message and no console entry — indistinguishable from the agent never having sent one. */
export function HtmlPreviewPanel({ preview, failure, loading, onClose }: Props) {
  if (!preview && loading) {
    return (
      <PanelShell onClose={onClose} title="HTML preview">
        <div
          data-test-id="html-preview-loading"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontSize: 12,
            color: 'var(--muted-foreground, #627d98)',
          }}
        >
          <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
          Loading the report…
        </div>
      </PanelShell>
    )
  }

  if (!preview && failure) {
    return (
      <PanelShell onClose={onClose} title="HTML preview">
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
            <TriangleAlert size={15} />
            Couldn't load the report
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--muted-foreground, #627d98)' }}>
            {failure.reason}
          </p>
          {failure.url ? (
            <a
              href={failure.url}
              target="_blank"
              rel="noreferrer noopener"
              data-test-id="html-preview-open-external"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600 }}
            >
              <ExternalLink size={13} />
              Open it in a new tab
            </a>
          ) : null}
        </div>
      </PanelShell>
    )
  }

  if (!preview) return null

  return (
    <PanelShell onClose={onClose} title={preview.fileName || 'HTML preview'}>
      <iframe
        // Keying on the document forces a fresh frame per revision. Mutating `srcDoc` in
        // place leaves the old document's timers and listeners running underneath.
        key={preview.html.length + ':' + preview.html.slice(0, 64)}
        data-test-id="html-preview-iframe"
        srcDoc={preview.html}
        sandbox={SANDBOX}
        referrerPolicy="no-referrer"
        style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
        title={preview.fileName || 'HTML preview'}
      />
    </PanelShell>
  )
}
