import { PLM_AGENT_ID } from '@/features/copilot/agent'
import React, { lazy } from 'react'

/** Lazy-load the ask-panel copilot (pulls the ~2.3 MB SDK chunk on first open). */
const AskPanelCopilot = lazy(() =>
  import('@/features/copilot/AskPanelCopilot').then((m) => ({ default: m.AskPanelCopilot }))
)

function AskOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  go: (v: any) => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Scrim */}
      <div
        className="modalbg"
        style={{ background: "rgba(3,38,68,.28)", zIndex: 65 }}
        onClick={onClose}
        data-test-id="ask-scrim"
      />

      {/* Third-pane panel */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          height: "100vh",
          background: "#ffffff",
          boxShadow: "-10px 0 40px rgba(2,42,66,.2)",
          borderRadius: "10px 0 0 10px",
          zIndex: 70,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        data-test-id="ask-panel"
        aria-label="Ask AI panel"
      >
        <React.Suspense fallback={<div style={{ flex: 1 }} />}>
          <AskPanelCopilot
            agentId={PLM_AGENT_ID}
            onClose={onClose}
            className="flex-1 min-h-0"
          />
        </React.Suspense>
      </aside>
    </>
  );
}

export { AskOverlay }


