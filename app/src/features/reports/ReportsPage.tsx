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
 * Artifact detection works through the StatusBridge inside the copilot provider:
 *   agent finishes → StatusBridge fires onStatusChange → handleStatusChange detects the
 *   isGenerating true→false edge → POST /api/lookup → downloadUrl → fetch with credentials
 *   → setHtml(text) → render via srcDoc on the panel iframe.
 *
 * The same chatId-change path fires on page reload and history navigation so past
 * artifacts are always visible without waiting for a new generation.
 *
 * `renderHeaderActions` is accepted for parity with every other screen the shell can
 * mount, but deliberately not rendered: this screen has no header of its own — the
 * copilot's own chrome occupies that row. */
export function Reports(_props: { renderHeaderActions?: () => React.ReactNode } = {}) {
  const { attachRef, preview, failure, isFetching, handleStatusChange, dismiss } = useHtmlFromCopilot()
  const showPanel = Boolean(preview || failure || isFetching)

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
        data-test-id="reports-chat-column"
      >
        <Suspense fallback={<div style={{ flex: 1 }} />}>
          <LazyCopilot
            agentId={PLM_AGENT_ID}
            title="PLM Agent"
            className="flex-1 min-h-0"
            onStatusChange={handleStatusChange}
          />
        </Suspense>
      </div>
      {showPanel ? (
        <HtmlPreviewPanel
          preview={preview}
          failure={failure}
          isFetching={isFetching}
          onClose={dismiss}
        />
      ) : null}
    </div>
  )
}
