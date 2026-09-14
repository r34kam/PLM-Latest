import { CompactInspectStageList } from '@/components/lifecycle/CompactInspectStageList'
import { WhereThisStandsBand } from '@/components/lifecycle/WhereThisStandsBand'
import { stageChip } from '@/components/primitives/Chip'
import { SpecList } from '@/components/primitives/SpecList'
import { LC, ecoById } from '@/domain/ecos'
import { deriveApprovalState } from '@/domain/routings'
import { T } from '@/theme/tokens'
import { ChevronRight, Eye, X } from 'lucide-react'
import React from 'react'

function InspectRailContent({ ecoId, go }: { ecoId: string; go: (v: any) => void }) {
  const eco = ecoById(ecoId || "ECO-011420");
  const approvalState = deriveApprovalState(eco);
  const rejected = eco.stage === "Rejected";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div className="bet" style={{ alignItems: "center", marginBottom: 6 }}>
          <span className="pn" style={{ fontSize: 13 }}>{eco.id}</span>
          {stageChip(eco.stage)}
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, color: T.g900, margin: 0 }}>
          {eco.title}
        </h2>
        <div className="sub" style={{ marginTop: 4 }}>
          {eco.routing} &middot; {eco.div} &middot; {eco.site}
        </div>
      </div>

      <div className="card" style={{ padding: "12px 14px" }}>
        <CompactInspectStageList
          stages={LC}
          current={rejected ? "Approval" : eco.stage}
          rejected={rejected}
        />
      </div>

      <WhereThisStandsBand eco={eco} stacked />

      <div className="card" style={{ padding: "12px 14px" }}>
        <SpecList rows={[
          ["Creator", eco.creator],
          ["Submitter", eco.submitter],
          ["Created on", eco.created],
          ["Submitted on", eco.submitted || "—"],
          ["Items / mods", `${eco.items} items / ${eco.mods} mods`],
        ]} />
      </div>

      <div style={{ marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${T.g200}` }}>
        <button
          type="button"
          className="btn pri"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => go({ page: "eco", id: eco.id })}
          data-test-id="rail-inspect-open-full"
        >
          Open full page <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
function InspectRail({
  open,
  ecoId,
  onClose,
  go,
}: {
  open: boolean;
  ecoId: string;
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
        data-test-id="inspect-scrim"
      />
      <aside
        className="rightrail"
        data-test-id="right-hand-rail"
        aria-label="Inspect panel"
      >
        <div
          className="rightrail-head"
          style={{
            padding: "12px 14px",
            borderBottom: `1px solid ${T.g100}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff",
            flex: "none"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eye size={15} color={T.brand} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600, color: T.g900 }}>Inspect change</span>
          </div>
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
        <div className="rightrail-body">
          <InspectRailContent ecoId={ecoId} go={go} />
        </div>
      </aside>
    </>
  );
}

export { InspectRailContent, InspectRail }


