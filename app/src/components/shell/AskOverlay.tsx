import { PLM_AGENT_ID } from '@/features/copilot/agent'
import { LazyCopilot } from '@/features/copilot/LazyCopilot'
import { X } from 'lucide-react'
import React from 'react'

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
      <div
        className="modalbg"
        style={{ background: "rgba(3,38,68,.28)", zIndex: 65 }}
        onClick={onClose}
        data-test-id="ask-scrim"
      />
      <aside
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 440,
          height: "100vh",
          background: "var(--background)",
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
        {/* Close button only — no extra header info */}
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 2,
          }}
        >
          <button
            type="button"
            className="btn gh sm"
            onClick={onClose}
            aria-label="Close"
            data-test-id="rail-close-btn"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        {/* Real copilot — same agent as the Reports page */}
        <React.Suspense fallback={<div style={{ flex: 1 }} />}>
          <LazyCopilot
            agentId={PLM_AGENT_ID}
            title="PLM Agent"
            className="flex-1 min-h-0"
          />
        </React.Suspense>
      </aside>
    </>
  );
}

export { AskOverlay }


