import { deriveApprovalState } from '@/domain/routings'
import { T } from '@/theme/tokens'
import React from 'react'

function WhereThisStandsBand({
  eco,
  stacked = false,
  rejectedNotice,
}: {
  eco: any;
  stacked?: boolean;
  rejectedNotice?: React.ReactNode;
}) {
  const approvalState = deriveApprovalState(eco);
  const rejected = eco.stage === "Rejected";
  let blockingVal = "";
  let outstandingVal = "";
  let nextFromYouVal = "";

  if (rejected) {
    const rejectApprover = "Carol Nosworthy";
    blockingVal = "Rejected by the approver named in Approvals";
    outstandingVal = rejectApprover;
    nextFromYouVal = "Withdraw to Open, attach the missing evidence, re-raise";
  } else if (eco.stage === "Approval") {
    const { open, requiredCount, openCount } = approvalState;
    blockingVal = `Stage 1 of 2 – ${openCount} of ${requiredCount} approvals still open`;

    const pendingNames = open.map((x: any) => x.n);
    if (pendingNames.length === 0) {
      outstandingVal = "All Stage 1 approvers signed";
    } else if (pendingNames.length <= 3) {
      outstandingVal = pendingNames.length === 1 ? pendingNames[0] : `${pendingNames.slice(0, -1).join(", ")} and ${pendingNames[pendingNames.length - 1]}`;
    } else if (pendingNames.length === 4) {
      outstandingVal = `${pendingNames[0]}, ${pendingNames[1]}, ${pendingNames[2]} and 1 other`;
    } else {
      outstandingVal = `${pendingNames[0]}, ${pendingNames[1]}, ${pendingNames[2]} and ${pendingNames.length - 3} others`;
    }

    nextFromYouVal = "Your Stage 2 document control sign-off, once Stage 1 clears";
  } else if (eco.stage === "Open") {
    blockingVal = "Nothing – open and unlocked";
    outstandingVal = "No approvers yet";
    nextFromYouVal = "Submit to routing once the redlines match the summary description";
  } else if (eco.stage === "Effective") {
    blockingVal = "SAP ECC write-back pending confirmation";
    outstandingVal = "SAP interface · plant 1210";
    nextFromYouVal = "Verify SAP write-back matches and move change to Complete";
  } else if (eco.stage === "Complete") {
    blockingVal = "None – change is released and complete";
    outstandingVal = "Completed";
    nextFromYouVal = "None – change closed";
  } else {
    blockingVal = "Submission to routing";
    outstandingVal = eco.submitter === "—" ? eco.creator : eco.submitter;
    nextFromYouVal = "Submit to routing to begin approval stage";
  }

  return (
    <div
      style={{
        borderRadius: 10,
        border: "none",
        boxShadow: "0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.20)",
        background: "#ffffff",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      data-test-id="where-this-stands-band"
    >
      {rejectedNotice && (
        <div style={{ borderBottom: "1px solid #F0F4F8" }}>
          {rejectedNotice}
        </div>
      )}
      <div
        style={{
          padding: 16,
          display: "grid",
          gridTemplateColumns: stacked ? "1fr" : "1.2fr 1fr 1.4fr",
          gap: 16,
          alignItems: "center",
          background: "linear-gradient(to right, rgba(5, 90, 175, 0.03), rgba(5, 90, 175, 0.03)), #ffffff",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }} data-test-id="where-stands-blocking">
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.g600 }}>
            Blocking
          </div>
          <div style={{ fontSize: 13, color: T.g900, fontWeight: 600, lineHeight: 1.4 }}>
            {blockingVal}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            borderLeft: stacked ? "none" : `1px solid ${T.g200}`,
            borderTop: stacked ? `1px solid ${T.g200}` : "none",
            paddingLeft: stacked ? 0 : 16,
            paddingTop: stacked ? 12 : 0,
          }}
          data-test-id="where-stands-outstanding"
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.g600 }}>
            Outstanding
          </div>
          <div style={{ fontSize: 13, color: T.g900, fontWeight: 600, lineHeight: 1.4 }}>
            {outstandingVal}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            borderLeft: stacked ? "none" : `1px solid ${T.g200}`,
            borderTop: stacked ? `1px solid ${T.g200}` : "none",
            paddingLeft: stacked ? 0 : 16,
            paddingTop: stacked ? 12 : 0,
          }}
          data-test-id="where-stands-next"
        >
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: T.g600 }}>
            Next from you
          </div>
          <div style={{ fontSize: 13, color: T.g900, fontWeight: 600, lineHeight: 1.4 }}>
            {nextFromYouVal}
          </div>
        </div>
      </div>
    </div>
  );
}

export { WhereThisStandsBand }


