import { PEOPLE, inGroup } from '@/domain/people'
import { ME } from '@/domain/session'

/* ---------------- routings: each one a genuinely different flow ---------------- */
const R = (g: any, req: any, stage: any, site?: any) => ({ g: site ? `${g} – ${site}` : g, req, stage, members: inGroup(g, site).slice(0, 4) });
const ROUTINGS: Record<string, any[]> = {
  "ECO Construction": [
    R("Construction Engineering", "One or more", 1), R("Construction Product Mgmt", "One or more", 1),
    R("ECCN Verification", "Optional", 1),
    R("Manufacturing Engineering", "One or more", 1), R("Master Scheduling", "One or more", 1),
    R("Materials", "One or more", 1), R("PLM", "One or more", 1),
    R("Production", "One or more", 1), R("Quality Assurance (QA)", "One or more", 1),
    R("TEP NPI", "Comments only", 1), R("Document Control TPS", "One or more", 2, "Livermore"),
  ],
  "ECO Agriculture – Fort": [
    R("AG Engineering", "One or more", 1, "Fort Collins"), R("AG Product Mgmt", "One or more", 1, "Fort Collins"),
    R("Manufacturing Engineering", "One or more", 1), R("Materials", "One or more", 1, "Fort Collins"),
    R("Quality Assurance (QA)", "One or more", 1, "Fort Collins"), R("ECCN Verification", "Optional", 1),
    R("AG Doc Control", "One or more", 2, "Fort Collins"),
  ],
  "ECO Agriculture – Adelaide": [
    R("AG Engineering", "All members", 1, "Adelaide"), R("Production", "One or more", 1, "Adelaide"),
    R("Materials", "One or more", 1, "Adelaide"), R("Service", "Comments only", 1, "Adelaide"),
    R("AG Doc Control", "One or more", 2, "Adelaide"),
  ],
  "ECO IA (Inactivation) – Survey": [
    R("PLM", "One or more", 1), R("Materials", "One or more", 1),
    R("Master Scheduling", "One or more", 1), R("Service", "One or more", 1),
    R("Finance", "Optional", 1), R("Document Control TPS", "One or more", 2, "Livermore"),
  ],
  "TPCO – Third Party": [
    R("Construction Product Mgmt", "One or more", 1), R("Sales", "One or more", 1),
    R("Service", "One or more", 1), R("Finance", "All members", 1),
    R("Document Control TPS", "One or more", 2, "Livermore"),
  ],
  "DCO – Document Control": [
    R("PLM", "One or more", 1), R("Quality Assurance (QA)", "Optional", 1),
    R("Document Control TPS", "One or more", 2, "Livermore"),
  ],
  "RFD – Quality": [
    R("Quality Assurance (QA)", "All members", 1), R("Manufacturing Test Engineering", "One or more", 1),
    R("Construction Engineering", "One or more", 1), R("Production", "Comments only", 1),
    R("Document Control TPS", "One or more", 2, "Livermore"),
  ],
  "ECO Tokyo – Electronics": [
    R("Manufacturing Engineering", "One or more", 1, "Tokyo"), R("Manufacturing Test Engineering", "One or more", 1, "Tokyo"),
    R("Master Scheduling", "One or more", 1, "Tokyo"), R("Sales", "Comments only", 1, "Tokyo"),
    R("Document Control TPS", "One or more", 2, "Livermore"),
  ],
};
const ROUTING_NAMES = Object.keys(ROUTINGS);
/* decisions for a change, derived from its routing and how far through it is */
const DECISION_NOTES = [
  "Verified redline against the drawing.", "No list price impact confirmed.", "Stock position checked, no shortage.",
  "Work instructions will be revised in the same week.", "Compliance evidence already on file.",
  "Agreed, provided the supplier declaration follows.", "", "", "",
];
function approvalsFor(routing: any, stage?: any) {
  const rows = ROUTINGS[routing] || ROUTINGS["ECO Construction"];
  const s1 = rows.filter((r: any) => r.stage === 1);
  return s1.map((r: any, k: any) => {
    const isCommentsOnly = r.req === "Comments only";
    const who = r.members[0] || "Unassigned";
    let st = "pending";
    if (isCommentsOnly) {
      st = "comments";
    } else if (stage === "Complete" || stage === "Effective") {
      st = "approved";
    } else if (stage === "Rejected") {
      st = k < Math.round(s1.length * 0.5) ? "approved" : "pending";
    } else if (stage === "Approval") {
      // 6 decided, 3 open on required roles
      st = k < 6 ? "approved" : "pending";
    }
    return {
      n: who, g: r.g, req: r.req, st,
      at: st === "approved" ? `09/${String(9 + (k % 2)).padStart(2, "0")}/2026 ${String(8 + k % 9).padStart(2, "0")}:${String(10 + k * 3).slice(0, 2)} AM` : "",
      cm: st === "approved" ? DECISION_NOTES[k % DECISION_NOTES.length] : isCommentsOnly ? "Comments recorded" : "",
      others: r.members.slice(1),
    };
  });
}
/* Single global derivation for approval state across all surfaces */
function deriveApprovalState(ecoOrRouting: any, stage?: any) {
  const routing = typeof ecoOrRouting === "string" ? ecoOrRouting : ecoOrRouting.routing;
  const stg = typeof ecoOrRouting === "string" ? stage : ecoOrRouting.stage;
  const roles = approvalsFor(routing, stg);
  const required = roles.filter((r: any) => r.req !== "Comments only");
  const decided = required.filter((r: any) => r.st !== "pending");
  const open = required.filter((r: any) => r.st === "pending");
  const commentsOnly = roles.filter((r: any) => r.req === "Comments only");
  return {
    roles,
    required,
    decided,
    open,
    commentsOnly,
    totalCount: roles.length,
    requiredCount: required.length,
    decidedCount: decided.length,
    openCount: open.length,
  };
}
function notificationRecipientsFor(eco: any) {
  const submitterName = eco?.submitter && eco.submitter !== "—" ? eco.submitter : ME.name;
  const map = new Map();

  // Submitter / initiator always listed first with combined reason
  map.set(submitterName, {
    name: submitterName,
    reason: "Part of the decision board · submitted this change",
    notifyOn: "Every status change",
  });

  // Decision board members from PEOPLE - deduplicated against submitter
  for (const p of PEOPLE.slice(0, 10)) {
    if (map.has(p.n)) {
      const existing = map.get(p.n);
      if (!existing.reason.includes("submitted this change")) {
        existing.reason = `${existing.reason} · Part of the decision board`;
      }
    } else {
      map.set(p.n, {
        name: p.n,
        reason: "Part of the decision board",
        notifyOn: "Every status change",
      });
    }
  }

  return Array.from(map.values());
}

export { R, ROUTINGS, ROUTING_NAMES, DECISION_NOTES, approvalsFor, deriveApprovalState, notificationRecipientsFor }


