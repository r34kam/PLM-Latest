import { Suspense } from 'react'
import { PLM_AGENT_ID } from '@/features/copilot/agent'
import { HtmlPreviewPanel } from '@/features/copilot/HtmlPreviewPanel'
import { LazyCopilot } from '@/features/copilot/LazyCopilot'
import { useHtmlFromCopilot } from '@/features/copilot/useHtmlFromCopilot'

/** The Reports workspace: the PLM agent on the left, and whatever HTML it produces on
 * the right.
 *
 * The negative margins cancel `.wrap`'s padding (22px top, 24px sides, 64px bottom) so
 * the copilot fills the workspace, and the height is the viewport minus the 52px topbar.
 * `min-h-0` down the flex chain is what makes the conversation scroll instead of the
 * page — a flex child defaults to `min-height: auto` and would otherwise grow to fit
 * every message.
 *
 * `renderHeaderActions` is accepted for parity with every other screen the shell can
 * mount, but deliberately not rendered: this screen has no header of its own — the
 * copilot's own chrome occupies that row. */
export function Reports(_props: { renderHeaderActions?: () => React.ReactNode } = {}) {
  const { attachRef, preview, failure, dismiss } = useHtmlFromCopilot()
  const showPanel = Boolean(preview || failure)

  return (
    <div
      data-test-id="reports-copilot-page"
      style={{
        margin: '-22px -24px -64px',
        height: 'calc(100vh - 52px)',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}
    >
      <div
        ref={attachRef}
        style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <Suspense fallback={<div style={{ flex: 1 }} />}>
          <LazyCopilot agentId={PLM_AGENT_ID} title="PLM Agent" className="flex-1 min-h-0" />
        </Suspense>
      </div>
      {showPanel ? <HtmlPreviewPanel preview={preview} failure={failure} onClose={dismiss} /> : null}
    </div>
  )
}
