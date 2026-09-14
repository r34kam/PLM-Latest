import { AlertTriangle, Clock, Database, Sparkles } from 'lucide-react'

/* ========================== NOTIFICATIONS =========================== */

const NOTIFS = [
  {
    id: "ECO-011416",
    group: "Today",
    title: "BOM correction to 1007886-02",
    detail: "SAP write-back confirmed",
    meta: "SAP write-back confirmed · 14 minutes ago",
    timestamp: "14 minutes ago",
    tone: "vio",
    icon: Database,
    signals: ["SAP ECC", "Plant 1210", "3 items matched"],
    alerts: "Ready to close",
    insight: "All three items and both BOM changes now match in SAP. Nothing is outstanding — moving this to Complete closes the change and releases the items for the next revision.",
    go: { page: "eco", id: "ECO-011416" },
  },
  {
    id: "DCO-008335",
    group: "Today",
    title: "Reactivate 1002261-01",
    detail: "Rejected by Quality Assurance",
    meta: "Rejected by Quality Assurance · 2 hours ago",
    timestamp: "2 hours ago",
    tone: "bad",
    icon: AlertTriangle,
    signals: ["Rejection", "Evidence missing", "Held by document control"],
    alerts: "1 blocking issue",
    insight: "Carol Nosworthy rejected this for a missing inspection report, not an engineering fault. Document control can resolve it without an engineer round-trip: attach INSP-2026-0448, then re-submit. The five approvers who already signed will be asked again.",
    go: { page: "eco", id: "DCO-008335" },
  },
  {
    id: "ECO-010870",
    group: "Today",
    title: "Move to Status 50 – Ag Kits",
    detail: "Unique parts analysis finished",
    meta: "Unique parts analysis finished · 3 hours ago",
    timestamp: "3 hours ago",
    tone: "blue",
    icon: Sparkles,
    signals: ["129 requested", "265 modifications", "9 unique children"],
    alerts: "Cascade ready",
    insight: "The analysis expanded 129 requested parts into 265 modifications. Nine children under 01-080401-03 report only to that parent and will be orphaned unless they are inactivated with it. Three shared components were excluded automatically.",
    go: { page: "inactivate" },
  },
  {
    id: "ECO-011420",
    group: "Earlier",
    title: "Update 1003140-01",
    detail: "3 approvals outstanding",
    meta: "3 approvals outstanding · 1 day in stage",
    timestamp: "1 day ago",
    tone: "warn",
    icon: Clock,
    signals: ["Stage 1 of 2", "6 of 9 decisions", "Past average cycle"],
    alerts: "3 approvers idle 24h+",
    insight: "Steve Howe, Grace Mutiso and Carol Nosworthy have not opened this change since it was submitted. Reminding PLM, Production and Quality Assurance would clear the three roles that are blocking.",
    go: { page: "eco", id: "ECO-011420", tab: "Approvals" },
  },
];

export { NOTIFS }


