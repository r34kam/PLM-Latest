import { ExternalLink, TriangleAlert, X } from 'lucide-react'
import type { CopilotHtml, CopilotHtmlFailure } from './useHtmlFromCopilot'

/* What the iframe is allowed to do.
 *
 * `allow-same-origin` is deliberately ABSENT. Paired with `allow-scripts` it hands the
 * framed document the app's own origin, which lets it reach straight back out through
 * `parent` — the browser treats that pair as an escape from the sandbox rather than a
 * use of it. It also does not survive nesting: this app itself runs inside the platform's
 * sandboxed preview frame, and a child frame can never hold a permission its parent
 * lacks, so asking for it got the whole sandbox attribute refused and the document
 * rendered blank.
 *
 * Without it the document gets an opaque origin. Scripts, forms, popups and dialogs all
 * still work — an agent-generated page has no business touching this app's storage. */
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals'

type Props = {
  preview: CopilotHtml | null
  failure: CopilotHtmlFailure | null
  onClose: () => void
}

function PanelShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
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
        <span style={{ fontWeight: 600, fontSize: 13 }}>HTML preview</span>
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

/** Renders whatever HTML the agent produced, or explains why it could not.
 *
 * The failure branch matters as much as the success one. The version this replaces
 * caught fetch errors into an empty block, so a cross-origin artifact produced no
 * preview, no message and no console entry — indistinguishable from the agent never
 * having sent a file. */
export function HtmlPreviewPanel({ preview, failure, onClose }: Props) {
  if (!preview && failure) {
    return (
      <PanelShell onClose={onClose}>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13 }}>
            <TriangleAlert size={15} />
            Couldn't load the attached file
          </div>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--muted-foreground, #627d98)' }}>
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
            Open it in a new tab
          </a>
        </div>
      </PanelShell>
    )
  }

  if (!preview) return null

  return (
    <PanelShell onClose={onClose}>
      <iframe
        // Keying on the document forces a fresh frame per revision. Mutating `srcDoc` in
        // place leaves the old document's timers and listeners running underneath.
        key={preview.html.length + ':' + preview.html.slice(0, 64)}
        data-test-id="html-preview-iframe"
        srcDoc={preview.html}
        sandbox={SANDBOX}
        referrerPolicy="no-referrer"
        style={{ flex: 1, border: 'none', width: '100%', background: '#fff' }}
        title="HTML preview"
      />
    </PanelShell>
  )
}
