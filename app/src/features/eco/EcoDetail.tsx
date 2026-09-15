import { FileUploadModal, type StagedFile } from '@/components/data-io/FileUpload'
import { Lifecycle } from '@/components/lifecycle/Lifecycle'
import { WhereThisStandsBand } from '@/components/lifecycle/WhereThisStandsBand'
import { SupplierShare } from '@/components/pickers/SupplierShare'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip, stageChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Field, Input, Select } from '@/components/primitives/Field'
import { Modal } from '@/components/primitives/Modal'
import { SpecList } from '@/components/primitives/SpecList'
import { Tabs } from '@/components/primitives/Tabs'
import { BOM_1003140, whereUsed } from '@/domain/boms'
import { ECO_010870_ITEMS, LC, ecoById, historyFor } from '@/domain/ecos'
import { ROUTINGS, deriveApprovalState, notificationRecipientsFor } from '@/domain/routings'
import { ME } from '@/domain/session'
import { suppliersFor } from '@/domain/suppliers'
import { useAllChangeOrders, useUpdateChangeOrder, type EcoComment } from '@/data/changeOrders'
import { useExportEcoExcel } from '@/data/export'
import { useSendReminder } from '@/data/reminder'
import { downloadFile } from '@/lib/download'
import { toast } from 'sonner'
import { initials } from '@/lib/prng'
import { T } from '@/theme/tokens'
import { AlertCircle, AlertTriangle, Ban, Bell, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Clock, CornerUpLeft, Database, Download, FileText, Info, Layers, Link2, Loader2, MessageSquare, Plus, RefreshCw, Send, Sparkles, Trash2, Upload, Users, X } from 'lucide-react'
import React, { useState } from 'react'

function EcoDetail({ id, go, initialTab, renderHeaderActions, role = 'unknown', currentUserName = '' }: { id: any; go: any; initialTab?: string; renderHeaderActions?: () => React.ReactNode; role?: string; currentUserName?: string }) {
  const isApproverRole = role === 'approver'
  const { sendReminder } = useSendReminder()
  // Try static domain first; then overlay with backend data for backend-created COs
  const { data: allBackendOrders } = useAllChangeOrders();
  const backendCo = allBackendOrders.find((o) => o.coId === id);
  const staticEco = ecoById(id);
  // Build a merged ECO object — backend fields win where present
  const eco = backendCo
    ? {
        ...staticEco,
        id: backendCo.coId,
        title: backendCo.title,
        cat: backendCo.cat,
        stage: backendCo.stage,
        div: backendCo.div,
        site: backendCo.site,
        routing: backendCo.routing,
        creator: backendCo.creator,
        submitter: backendCo.submitter,
        dc: backendCo.dc,
        created: backendCo.created,
        submitted: backendCo.submitted,
        items: backendCo.itemCount,
        mods: backendCo.modCount,
        pns: (() => { try { return JSON.parse(backendCo.pnsJson); } catch { return []; } })(),
        desc: backendCo.desc,
        redline: backendCo.redline,
        notes: backendCo.notes,
        ecoItems: backendCo.ecoItems ?? [],
        comments: backendCo.comments ?? [],
      }
    : { ...staticEco, ecoItems: [] as any[], comments: [] as any[] };
  // Use real persisted approvals from backend when available; fall back to derived for static ECOs.
  // Normalise backend ApprovalEntry shape to the legacy {g, n, req, st, at, cm, others} shape
  // that the Approvals tab rendering already uses — keeping one render path.
  const backendApprovals = backendCo?.approvals ?? []
  const approvalState = backendApprovals.length > 0
    ? (() => {
        const roles = backendApprovals.map((a) => ({
          g: a.role,
          n: a.approver,
          req: a.req,
          stage: a.stage,
          st: a.status,
          at: a.signedAt,
          cm: a.comment,
          others: a.others ?? [],
        }))
        const required = roles.filter((r) => r.req !== 'Comments only')
        const decided = required.filter((r) => r.st !== 'pending')
        const open = required.filter((r) => r.st === 'pending')
        const commentsOnly = roles.filter((r) => r.req === 'Comments only')
        return { roles, required, decided, open, commentsOnly, totalCount: roles.length, requiredCount: required.length, decidedCount: decided.length, openCount: open.length }
      })()
    : deriveApprovalState(eco)
  const APPROVALS = approvalState.roles;
  const HISTORY = historyFor(eco);
  const rejected = eco.stage === "Rejected";
  const TABS = ["Summary", "Items", "Files", "Approvals", "Supplier access", "Notifications", "History"];
  const [tab, setTab] = useState(
    initialTab && TABS.includes(initialTab)
      ? initialTab
      : "Summary"
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [modal, setModal] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [aiReview, setAiReview] = useState(false);
  const [actions, setActions] = useState(false);
  const [shared, setShared] = useState<any[]>([]);
  const [shareDraft, setShareDraft] = useState<any[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<StagedFile[]>([]);
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [itemSub, setItemSub] = useState("Modifications");
  const [activeRedlineItem, setActiveRedlineItem] = useState<any>(null);
  const [modPage, setModPage] = useState(1);
  const [selectedPns, setSelectedPns] = useState<any[]>([]);

  /* ---- ECO Excel export ---- */
  const { runExport: runEcoExcelExport, isPending: isExporting } = useExportEcoExcel()

  const handleExportExcel = async () => {
    setActions(false)
    try {
      toast.loading('Generating Excel…', { id: 'eco-export' })
      await runEcoExcelExport(eco.id)
      toast.dismiss('eco-export')
      toast.success('Excel downloaded.')
    } catch (err) {
      toast.dismiss('eco-export')
      toast.error('Export failed — please try again.')
    }
  }

  /* ---- Approve / Reject for Approver role ---- */
  const updateChangeOrder = useUpdateChangeOrder()
  const [approvalDone, setApprovalDone] = useState<'approved' | 'rejected' | null>(null)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isRejecting, setIsRejecting] = useState(false)
  const canApprove = isApproverRole && eco.stage === 'Approval' && (eco.awaitingMe === true || eco.mine === true)
  const handleApprove = () => { setApprovalDone('approved') }
  const handleReject = async () => {
    if (!rejectReason.trim()) return
    setIsRejecting(true)
    try {
      if (backendCo) {
        await updateChangeOrder(backendCo.id, { stage: 'Rejected' })
      }
      setApprovalDone('rejected')
      setRejectModal(false)
      setRejectReason('')
    } catch {
      toast.error('Failed to update status — please try again.')
    } finally {
      setIsRejecting(false)
    }
  }

  /* ---- Comment drawer ---- */
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false)
  const [commentAuthor, setCommentAuthor] = useState(currentUserName || ME.name)
  const [commentText, setCommentText] = useState('')
  const [isSavingComment, setIsSavingComment] = useState(false)

  const handleSaveComment = async () => {
    if (!commentText.trim() || !commentAuthor.trim()) return
    const newComment: EcoComment = {
      id: `c-${Date.now()}`,
      author: commentAuthor.trim(),
      message: commentText.trim(),
      timestamp: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    }
    const updatedComments = [...(eco.comments ?? []), newComment]
    setIsSavingComment(true)
    try {
      if (backendCo) {
        await updateChangeOrder(backendCo.id, { comments: updatedComments })
      }
      setCommentText('')
      setCommentDrawerOpen(false)
      toast.success('Comment added.')
    } catch {
      toast.error('Failed to save comment — please try again.')
    } finally {
      setIsSavingComment(false)
    }
  }

  // Reset page when switching ECO or changing view
  React.useEffect(() => {
    setModPage(1);
    setSelectedPns([]);
    setActiveRedlineItem(null);
    setDetailsOpen(false);
  }, [id]);

  React.useEffect(() => {
    if (initialTab && TABS.includes(initialTab)) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const redlineTarget = activeRedlineItem || (eco.id === "ECO-010870" ? ECO_010870_ITEMS[0] : null);

  return (
    <div className="stack" data-test-id="eco-detail-page">
      <div>
        <div className="crumb"><a onClick={() => go({ page: "ecos" })}>Changes</a><ChevronRight size={11} />{eco.id}</div>
        <div className="bet">
          <div className="row" style={{ gap: 10 }}>
            <h1>{eco.id}</h1>
            {stageChip(rejected ? "Rejected" : eco.stage)}
            <span className="sub">{eco.title}</span>
          </div>
          <div className="row">
            {/* Approver-role actions: approve / reject this ECO */}
            {isApproverRole && canApprove && approvalDone === null && (
              <>
                <button className="btn dan" onClick={() => setRejectModal(true)} data-test-id="approver-reject-btn">
                  <X size={13} />Reject
                </button>
                <button className="btn ok" onClick={handleApprove} data-test-id="approver-approve-btn">
                  <Check size={13} />Approve
                </button>
              </>
            )}
            {isApproverRole && approvalDone === 'approved' && (
              <span className="chip c-ok" style={{ fontSize: 13, padding: "6px 12px" }} data-test-id="approver-approved-badge">
                <Check size={13} />Your approval recorded
              </span>
            )}
            {isApproverRole && approvalDone === 'rejected' && (
              <span className="chip c-bad" style={{ fontSize: 13, padding: "6px 12px" }} data-test-id="approver-rejected-badge">
                <X size={13} />Rejection submitted
              </span>
            )}

            {/* DC-only actions */}
            {!isApproverRole && rejected && <button className="btn dan" onClick={() => setModal("withdraw")}><CornerUpLeft size={13} />Withdraw to Open</button>}
            {!isApproverRole && eco.stage === "Approval" && <>
              <button className="btn" onClick={() => setRejectModal(true)}><X size={13} />Reject</button>
              <button className="btn ok" onClick={() => setModal("approve")}><Check size={13} />Approve</button>
            </>}
            {!isApproverRole && eco.stage === "Open" && <button className="btn pri"><Send size={13} />Submit to routing</button>}
            {!isApproverRole && eco.stage === "Effective" && <button className="btn pri" onClick={() => setModal("complete")}><CheckCircle2 size={13} />Verify SAP and complete</button>}
            {!isApproverRole && (
              <div style={{ position: "relative" }}>
                <button className="btn" onClick={() => setActions(!actions)}>Actions<ChevronDown size={13} /></button>
                {actions && (<>
                  <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setActions(false)} />
                  <div className="menu">
                    <button
                      onClick={handleExportExcel}
                      disabled={isExporting}
                      data-test-id="actions-export-excel-btn"
                    >
                      {isExporting ? <><Loader2 size={14} className="spin" />Generating…</> : <><Download size={14} />Export to Excel</>}
                    </button>
                    <button onClick={() => { setActions(false); setCommentDrawerOpen(true); }}>
                      <FileText size={14} />Add a comment
                    </button>
                    <button onClick={() => {
                      setActions(false);
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Link copied to clipboard');
                    }}>
                      <Link2 size={14} />Copy link
                    </button>
                    <div className="menusep" />
                    <button className="dang" onClick={() => { setActions(false); setModal("cancelEco"); }}>
                      <Ban size={14} />Cancel this change
                    </button>
                  </div>
                </>)}
              </div>
            )}
            {renderHeaderActions?.()}
          </div>
        </div>
      </div>
      <div className="card" style={{
        padding: "16px 24px 20px",
        paddingLeft: "100px"
      }}>
        <Lifecycle
          stages={LC}
          current={rejected ? "Approval" : eco.stage}
          rejected={rejected}
          sub={approvalState.requiredCount > 0 ? [Math.round((approvalState.decidedCount / approvalState.requiredCount) * 100), 0] : [60, 0]}
        />
      </div>
      {/* Combined Where this stands band + AI Rejection Insight */}
      <WhereThisStandsBand
        eco={eco}
        rejectedNotice={
          rejected ? (
            <div
              style={{
                padding: "14px 16px",
                background: "#FFF5F5",
                color: T.bad,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
              }}
              data-test-id="rejection-ai-insight-band"
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <AlertTriangle size={18} color={T.bad} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: T.bad }}>
                    Rejected by Carol Nosworthy (Quality Assurance) on 09/06/2026.
                  </div>
                  <div style={{ marginTop: 3, fontSize: 13, color: "#486581" }}>
                    “Deviation evidence not attached. Reactivation needs the last inspection report before I can sign.”
                  </div>
                </div>
              </div>
              <button
                className="btn dan sm"
                type="button"
                style={{ flexShrink: 0 }}
                onClick={() => setAiReview(!aiReview)}
              >
                <Sparkles size={12} />
                {aiReview ? "Close rework plan" : "Draft rework plan"}
              </button>
            </div>
          ) : null
        }
      />
      {aiReview && (
        <Card title="Rework plan" sub="Drafted from the rejection notes on this change — edit before you act"
          right={<button className="btn gh sm" onClick={() => setAiReview(false)}><X size={13} /></button>}>
          <ol className="bulletlist" style={{ paddingLeft: 18 }}>
            <li><b>Withdraw the change to Open.</b> Items cannot be edited in Approval.</li>
            <li><b>Document control can close this one.</b> The missing item is an inspection report, not an engineering change — attach
              INSP-2026-0448 to item 1002261-01 under Files. No engineer round-trip needed.</li>
            <li><b>Notify the requester</b> Brian Johmann so the rejection email does not sit unanswered.</li>
            <li><b>Re-submit to ECO Construction.</b> The five approvers who already signed will be asked again; their prior decisions are kept in History.</li>
          </ol>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn pri" onClick={() => setModal("withdraw")}>Withdraw and start rework</button>
            <button className="btn">Email the requester</button>
          </div>
        </Card>
      )}
      <Card pad={false}>
        <Tabs tabs={TABS} active={tab} onChange={setTab} />
        <div style={{ padding: 16 }}>

          {tab === "Summary" && (
            <div className="stack">
              {(eco.id === "ECO-010870" || (eco.notes && eco.notes.includes("Unique-parts cascade"))) && (
                <div
                  style={{
                    background: "linear-gradient(to right, rgba(5, 90, 175, 0.06), rgba(5, 90, 175, 0.02)), #ffffff",
                    borderRadius: 10,
                    border: "none",
                    boxShadow: "0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.20)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                  data-test-id="summary-ai-insight-cascade"
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: T.brand,
                    }}
                    data-test-id="summary-ai-insight-header"
                  >
                    <Sparkles size={12} strokeWidth={2.2} color={T.brand} />
                    <span>AI INSIGHT</span>
                  </div>

                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.5, fontWeight: 600 }} data-test-id="summary-ai-insight-body">
                    Cascade verified: 1 unique part updated across 2 parent assemblies
                  </div>

                  <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }} data-test-id="summary-ai-insight-sub">
                    Applied because child part was unique to these assemblies. Child revisions are locked.
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                    <button
                      className="btn pri sm"
                      onClick={() => go({ page: "inactivate", id: eco.pns?.[0] || "01-080401-03" })}
                      data-test-id="summary-review-cascade-btn"
                    >
                      Review cascade
                    </button>
                  </div>
                </div>
              )}

              <div className="grid2" data-test-id="eco-visible-fields">
                <SpecList rows={[
                  ["Routing", eco.routing],
                  ["Site", eco.site]
                ]} />
                <SpecList rows={[
                  ["Effectivity", "This change becomes effective once approved"],
                  ["Approval deadline", "None specified"]
                ]} />
              </div>

              <div style={{ marginTop: 2 }}>
                <button
                  type="button"
                  className="btn gh sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontWeight: 600,
                    color: T.brand,
                    padding: "4px 0",
                  }}
                  onClick={() => setDetailsOpen((prev: any) => !prev)}
                  aria-expanded={detailsOpen}
                  data-test-id="eco-details-disclosure-btn"
                >
                  <span>Details</span>
                  {detailsOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
                </button>
                {detailsOpen && (
                  <div style={{ marginTop: 8 }} data-test-id="eco-details-disclosure-content">
                    <div className="grid2">
                      <SpecList rows={[
                        ["Category", eco.cat],
                        ["Change number", eco.id],
                        ["Title", eco.title],
                        ["Division", eco.div === "AG" ? "AG – Agriculture" : "CO – Construction"],
                        ["Validations complete?", "N/A"],
                        ["Seed stock approved?", "N/A"],
                        ["Inventory disposition filled?", "Yes"],
                        ["DC rep", eco.dc],
                        ["Status notes", (eco.notes && eco.notes.includes("Unique-parts cascade")) ? "—" : (eco.notes || "—")]
                      ]} />
                      <SpecList rows={[
                        ["Expiration date", "N/A (this is a permanent change)"],
                        ["Lifecycle status", eco.stage],
                        ["Creator", eco.creator],
                        ["Submitter", eco.submitter],
                        ["Created on", eco.created],
                        ["Submitted on", eco.submitted],
                        ["Reference files", "1"],
                        ["Implementation files", "0"]
                      ]} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <h3 style={{ marginBottom: 6 }}>Description</h3>
                <div className="sub" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{eco.desc}</div>
              </div>
              {eco.redline && (
                <div>
                  <h3 style={{ marginBottom: 6 }}>Redline instructions</h3>
                  <pre style={{ margin: 0, padding: 12, background: T.g50, border: `1px solid ${T.g200}`, borderRadius: 6,
                    fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{eco.redline}</pre>
                </div>
              )}
            </div>
          )}

          {tab === "Items" && (
            <div className="stack">
              <div className="bet">
                <div className="seg">
                  {["Modifications", "BOM redline", "Affected assemblies", "Inventory disposition"].map((x: any) => (
                    <button key={x} className={itemSub === x ? "on" : ""} onClick={() => setItemSub(x)}>{x}</button>
                  ))}
                </div>
                <div className="row">
                  <button className="btn sm"><Upload size={12} />Bulk import</button>
                  <button className="btn sm"><Plus size={12} />Add item</button>
                </div>
              </div>

              {itemSub === "Modifications" && (() => {
                const isECO010870 = eco.id === "ECO-010870";
                // For backend-created COs, build item rows from pnsJson
                const backendItemsList = backendCo && eco.pns && eco.pns.length > 0
                  ? eco.pns.map((pn: string, idx: number) => ({
                      pn,
                      name: `Part ${pn}`,
                      phase: "In Production",
                      newPhase: "In Production",
                      rev: "A",
                      newRev: "B",
                      bom: idx === 0 ? "1 add" : null,
                      bomCount: idx === 0 ? 1 : 0,
                      specs: true,
                    }))
                  : null;
                const itemsList = isECO010870 ? ECO_010870_ITEMS
                  : backendItemsList ?? [
                      { pn: "1003140-01", name: "KIT, TS CG MOUNTING", phase: "In Production", newPhase: "In Production", rev: "B", newRev: "C", bom: "2 add · 1 delete", specs: true }
                    ];
                const pageSize = 25;
                const totalItems = itemsList.length;
                const totalPages = Math.ceil(totalItems / pageSize);
                const currentPage = isECO010870 ? Math.min(Math.max(modPage, 1), totalPages) : 1;
                const startIndex = (currentPage - 1) * pageSize;
                const endIndex = Math.min(startIndex + pageSize, totalItems);
                const currentRows = isECO010870 ? itemsList.slice(startIndex, endIndex) : itemsList;

                const allCurrentSelected = currentRows.length > 0 && currentRows.every((r: any) => selectedPns.includes(r.pn));
                const toggleSelectAllCurrent = () => {
                  if (allCurrentSelected) {
                    setSelectedPns(selectedPns.filter((pn: any) => !currentRows.some((r: any) => r.pn === pn)));
                  } else {
                    const toAdd = currentRows.map((r: any) => r.pn).filter((pn: any) => !selectedPns.includes(pn));
                    setSelectedPns([...selectedPns, ...toAdd]);
                  }
                };

                return (
                  <>
                    <div className="bet" style={{ marginBottom: 4 }}>
                      <div className="sub">{eco.items} item{eco.items > 1 ? "s" : ""} with {eco.mods} requested modifications</div>
                      {isECO010870 && totalItems > 0 && (
                        <div className="sub" style={{ fontWeight: 600 }} data-test-id="mod-count-line-top">
                          Showing {startIndex + 1}-{endIndex} of 129
                        </div>
                      )}
                    </div>
                    <div className="card" style={{ overflow: "hidden" }}>
                      <table className="tbl" data-test-id="modifications-table">
                      <thead>
                        <tr>
                          <th style={{ width: 30 }}>
                            <input
                              type="checkbox"
                              checked={allCurrentSelected}
                              onChange={toggleSelectAllCurrent}
                              title="Select / deselect page items"
                            />
                          </th>
                          <th style={{ width: 44 }}>#</th>
                          <th>Item number</th>
                          <th>Item name</th>
                          <th>Phase</th>
                          <th>New phase</th>
                          <th>Rev</th>
                          <th>New rev</th>
                          <th>BOM</th>
                          <th>Specs</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentRows.map((row: any, idx: any) => {
                          const globalIdx = startIndex + idx + 1;
                          const isChecked = selectedPns.includes(row.pn);
                          return (
                            <tr key={row.pn} className={isChecked ? "sel" : ""}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setSelectedPns(selectedPns.filter((p: any) => p !== row.pn));
                                    } else {
                                      setSelectedPns([...selectedPns, row.pn]);
                                    }
                                  }}
                                />
                              </td>
                              <td style={{ color: T.g600, fontSize: 13 }}>{globalIdx}</td>
                              <td>
                                <a className="pn" style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' }} onClick={() => go({ page: "item", id: row.pn })}>
                                  {row.pn}
                                </a>
                              </td>
                              <td style={{ fontWeight: 600 }}>{row.name}</td>
                              <td>{phaseChip(row.phase)}</td>
                              <td>{phaseChip(row.newPhase)}</td>
                              <td>{row.rev}</td>
                              <td><b>{row.newRev}</b></td>
                              <td>
                                {row.bom ? (
                                  <Chip k="blue">{row.bom}</Chip>
                                ) : (
                                  <span className="mut">—</span>
                                )}
                              </td>
                              <td>
                                {row.specs ? (
                                  <Check size={13} color={T.ok} strokeWidth={2.5} />
                                ) : (
                                  <span className="mut">—</span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  className="btn sm"
                                  onClick={() => {
                                    setActiveRedlineItem(row);
                                    setItemSub("BOM redline");
                                  }}
                                  data-test-id={`view-redline-btn-${row.pn}`}
                                >
                                  View redline
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>

                    {isECO010870 && totalPages > 1 && (
                      <div className="bet" style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${T.g200}` }}>
                        <div className="sub" data-test-id="mod-count-line">
                          Showing {startIndex + 1}-{endIndex} of 129
                        </div>
                        <div className="row" style={{ gap: 6 }}>
                          <button
                            className="btn sm"
                            disabled={currentPage === 1}
                            onClick={() => setModPage(currentPage - 1)}
                            style={{ opacity: currentPage === 1 ? 0.45 : 1, cursor: currentPage === 1 ? "default" : "pointer" }}
                            data-test-id="mod-page-prev"
                          >
                            <ChevronLeft size={13} strokeWidth={2} />
                            Previous
                          </button>
                          <div className="row" style={{ gap: 3 }}>
                            {Array.from({ length: totalPages }, (_: any, p: any) => p + 1).map((pg: any) => (
                              <button
                                key={pg}
                                className={`btn sm ${currentPage === pg ? "pri" : "gh"}`}
                                onClick={() => setModPage(pg)}
                                style={{ minWidth: 28, padding: "0 6px", height: 27 }}
                                data-test-id={`mod-page-${pg}`}
                              >
                                {pg}
                              </button>
                            ))}
                          </div>
                          <button
                            className="btn sm"
                            disabled={currentPage === totalPages}
                            onClick={() => setModPage(currentPage + 1)}
                            style={{ opacity: currentPage === totalPages ? 0.45 : 1, cursor: currentPage === totalPages ? "default" : "pointer" }}
                            data-test-id="mod-page-next"
                          >
                            Next
                            <ChevronRight size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {itemSub === "BOM redline" && (() => {
                // Use eco.affectedAssembly as the primary data source for the redlined kit
                const aa = eco.affectedAssembly;
                const target = redlineTarget;

                // Title/sub: prefer the linked affected assembly data, fall back to target item or BOM_1003140
                const redlineTitle = aa
                  ? `${aa.pn} — ${aa.name}`
                  : target
                  ? `${target.pn} — ${target.name}`
                  : "1003140-01 — KIT, TS CG MOUNTING";
                const redlineSub = aa
                  ? `Rev ${aa.fromRev} → Rev ${aa.toRev} · ${aa.bomEdits.filter((e: any) => e.op === "ADD").length} addition${aa.bomEdits.filter((e: any) => e.op === "ADD").length !== 1 ? "s" : ""}, ${aa.bomEdits.filter((e: any) => e.op === "DELETE").length} removal${aa.bomEdits.filter((e: any) => e.op === "DELETE").length !== 1 ? "s" : ""}`
                  : target
                  ? `Rev ${target.rev} → Rev ${target.newRev} · ${target.bom || "Inactivation redline"}`
                  : "Rev B → Rev C · 2 additions, 1 removal, 0 edited line items";

                // Build BOM rows: prefer affectedAssembly, then ecoItems (from creation), then static fallback
                const bomRowsFromAA = aa
                  ? aa.bomEdits.map((e: any) => ({
                      pn: e.pn, rev: "—", name: e.name, cat: "—", phase: "—",
                      qty: e.qty || "—",
                      st: e.op === "ADD" ? "add" : e.op === "DELETE" ? "del" : "upd",
                      op: e.op,
                      newValue: e.newValue,
                      warn: e.warn,
                    }))
                  : null;

                // From ecoItems stored at creation time — find the kit matching the selected/primary pn
                const ecoItemEdits = (() => {
                  if (!eco.ecoItems || eco.ecoItems.length === 0) return null;
                  const kitPn = activeRedlineItem?.pn ?? eco.ecoItems[0]?.pn;
                  const kit = eco.ecoItems.find((ki: any) => ki.pn === kitPn) ?? eco.ecoItems[0];
                  if (!kit || kit.bomEdits.length === 0) return null;
                  return kit.bomEdits.map((e: any) => ({
                    pn: e.pn, rev: "—", name: e.name, cat: "—", phase: "—",
                    qty: e.qty || "—",
                    st: e.type === "ADD" ? "add" : e.type === "DELETE" ? "del" : "upd",
                    op: e.type,
                    newValue: e.newValue,
                    warn: e.warn,
                  }));
                })();

                const bomRows = bomRowsFromAA ?? ecoItemEdits ?? BOM_1003140;

                return (
                  <Card title={redlineTitle} sub={redlineSub} pad={false}
                    right={<Chip k="gray">Editable by requester and document control</Chip>}
                    data-test-id="bom-redline-card">
                    <table className="tbl" data-test-id="bom-redline-table">
                      <thead><tr><th>#</th><th>Item number</th><th>Item name</th><th>Qty</th><th>Change</th></tr></thead>
                      <tbody>
                        {bomRows.map((b2: any, k: any) => (
                          <React.Fragment key={`${b2.pn}-${k}`}>
                            <tr data-test-id={`bom-redline-row-${b2.pn}`} style={b2.warn ? { background: T.warnBg } : undefined}>
                              <td>{k + 1}</td>
                              <td className={b2.st === "del" ? "del" : "pn"}>
                                {b2.warn && <AlertCircle size={11} style={{ color: T.warn, marginRight: 4, verticalAlign: 'middle' }} />}
                                {b2.pn}
                              </td>
                              <td className={b2.st === "del" ? "del" : b2.st === "add" ? "add" : ""}>
                                {b2.name}
                                {b2.op === "UPDATE_DESC" && b2.newValue && (
                                  <span className="mut" style={{ marginLeft: 8 }}>→ {b2.newValue}</span>
                                )}
                              </td>
                              <td>{b2.qty}</td>
                              <td>
                                {b2.st === "add" ? <Chip k="ok">Added</Chip>
                                  : b2.st === "del" ? <Chip k="bad">Removed</Chip>
                                  : b2.op === "UPDATE_DESC" ? <Chip k="blue">Desc updated</Chip>
                                  : b2.op === "UPDATE_QTY" ? <Chip k="warn">Qty updated</Chip>
                                  : <span className="mut">Unchanged</span>}
                              </td>
                            </tr>
                            {b2.warn && (
                              <tr data-test-id={`bom-redline-warn-${b2.pn}`}>
                                <td colSpan={5} style={{ padding: '4px 10px 8px', background: T.warnBg }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.warn, fontSize: 11 }}>
                                    <AlertCircle size={11} />{b2.warn}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                );
              })()}

              {itemSub === "Affected assemblies" && (() => {
                const isECO010870 = eco.id === "ECO-010870";

                // Derive affected assemblies: whereUsed on the kit being redlined (affectedAssembly.pn),
                // or fall back to each pn on the ECO.
                const aa = eco.affectedAssembly;
                const changedPns: string[] = aa
                  ? [aa.pn]
                  : eco.pns && eco.pns.length > 0 ? eco.pns : ["1003140-01"];

                type AffectedRow = {
                  parentPn: string;
                  parentName: string;
                  containsPn: string;
                  level: number;
                  phase: string;
                  div: string;
                  impact: string;
                };

                const derivedRows: AffectedRow[] = [];
                const seen = new Set<string>();
                for (const changedPn of changedPns) {
                  const parents = whereUsed(changedPn).filter(Boolean);
                  for (const parent of parents) {
                    if (!parent) continue;
                    const key = `${parent.pn}-${changedPn}`;
                    if (seen.has(key)) continue;
                    seen.add(key);
                    // Annotate with contextual impact text
                    const impact = parent.phase === "Discontinued" || parent.phase === "Obsolete"
                      ? "Discontinued — no action needed"
                      : changedPn === "9060-1319"
                      ? "Work instruction still references the removed tape"
                      : `Inherits rev change — verify no open orders`;
                    derivedRows.push({
                      parentPn: parent.pn,
                      parentName: parent.name,
                      containsPn: changedPn,
                      level: 1,
                      phase: parent.phase,
                      div: (parent as any).div || "CO",
                      impact,
                    });
                  }
                }

                // Fallback to curated rows when derived data has no results (for static ECOs)
                // Use the affectedAssembly pn when building the containsPn reference
                const kitPn = aa?.pn ?? "1003140-01";
                const staticRows: AffectedRow[] = isECO010870
                  ? [
                      { parentPn: "1021200-83", parentName: "RECEIVER, RL-H5A 1021200-83", containsPn: kitPn, level: 1, phase: "Discontinued", div: "AG", impact: "Discontinued — no action needed" },
                      { parentPn: "1007886-02", parentName: "ASSY, GNSS ANTENNA MOUNT", containsPn: kitPn, level: 1, phase: "Discontinued", div: "AG", impact: "Obsolete cascade applied" },
                      { parentPn: "1029732-01", parentName: "FC-5000/SC5000 BATTERY", containsPn: kitPn, level: 2, phase: "Discontinued", div: "AG", impact: "Discontinued — no action needed" },
                    ]
                  : [
                      { parentPn: "1021200-83", parentName: "RECEIVER, RL-H5A 1021200-83", containsPn: kitPn, level: 1, phase: "In Production", div: "AG", impact: `Inherits rev ${aa?.toRev ?? "C"} — no action needed` },
                      { parentPn: "1007886-02", parentName: "ASSY, GNSS ANTENNA MOUNT", containsPn: kitPn, level: 1, phase: "In Production", div: "CO", impact: "Work instruction still references the removed component" },
                      { parentPn: "01-080401-03", parentName: "ASSY, RECEIVER SGR1 (SDF)", containsPn: kitPn, level: 2, phase: "Discontinued", div: "AG", impact: "Discontinued — no action needed" },
                    ];

                const affRows = derivedRows.length > 0 ? derivedRows : staticRows;
                const hasWorkInstructionWarning = affRows.some((r) => r.impact.includes("still references"));

                return (
                  <>
                    <div className="sub">
                      Parent assemblies that contain {aa ? <><b>{aa.pn}</b> ({aa.name})</> : "an item on this change"} — derived from the live BOM.
                      These assemblies are not being redlined, but they inherit the revision result.
                    </div>
                    {affRows.length === 0 ? (
                      <div className="card" style={{ padding: 24, textAlign: "center", color: T.g500, fontSize: 13 }}>
                        No parent assemblies found for the items on this change.
                      </div>
                    ) : (
                      <div className="card" style={{ overflow: "hidden" }}>
                        <table className="tbl" data-test-id="affected-assemblies-table">
                          <thead>
                            <tr>
                              <th>Parent item</th>
                              <th>Name</th>
                              <th>Contains</th>
                              <th>Level</th>
                              <th>Phase</th>
                              <th>Division</th>
                              <th>Impact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {affRows.map((r, idx) => (
                              <tr key={`${r.parentPn}-${r.containsPn}-${idx}`} data-test-id={`affected-row-${r.parentPn}`}>
                                <td>
                                  <a className="pn" style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 12 }}
                                    onClick={() => go({ page: "item", id: r.parentPn })}>{r.parentPn}</a>
                                </td>
                                <td style={{ fontWeight: 500 }}>{r.parentName}</td>
                                <td>
                                  <span className="pn" style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: 12 }}>{r.containsPn}</span>
                                </td>
                                <td className="sub">Level {r.level}</td>
                                <td>{phaseChip(r.phase)}</td>
                                <td><Chip k={r.div === "AG" ? "teal" : "gray"}>{r.div}</Chip></td>
                                <td className="sub" style={{ color: r.impact.includes("still references") ? T.warn : T.g600 }}>
                                  {r.impact}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {hasWorkInstructionWarning && (
                      <div className="warnbox" data-test-id="affected-assemblies-warning">
                        A parent assembly still references a removed item in its assembly instructions.
                        That document sits outside this change — raise a DCO or add it here before the change goes effective.
                      </div>
                    )}
                  </>
                );
              })()}

              {itemSub === "Inventory disposition" && (() => {
                const isECO010870 = eco.id === "ECO-010870";
                const dispRows = isECO010870
                  ? [
                      ["01-080401-03", "ASSY, RECEIVER SGR1 (SDF)", 0, 0, 0, "Scrap"],
                      ["04-080401-10", "RADOME, FLASH GORDON MOLD LTGRAY SDF", 42, 0, 0, "Use up"],
                      ["04-080401-11", "RADOME, FLASH GORDON (SDF)", 18, 0, 0, "Use up"],
                      ["05-080401-01LF", "ASSY, FLASH GORDON LNA PCB", 5, 0, 0, "Scrap"],
                      ["05-080711-03LF", "ASSY,AG04 RECEIVER PCBA R5", 0, 0, 0, "Scrap"],
                    ]
                  : [
                      ["1003140-01", "KIT, TS CG MOUNTING", 148, 12, 200, "Use up"],
                      ["1006394-01", "WASHER FLAT M5", 9420, 0, 5000, "N/A — added"],
                      ["2505-0103", "SCR, M5-0.8 X 16MM HEX HD ZN", 6110, 0, 0, "N/A — added"],
                      ["9060-1319", "TAPE, DIECUT 3M VHB", 340, 0, 0, "Scrap"],
                    ];

                return (
                  <>
                    <div className="sub">What happens to stock already on hand when this change goes effective. Required before document control can sign.</div>
                    <div className="card" style={{ overflow: "hidden" }}>
                      <table className="tbl">
                        <thead><tr><th>Item number</th><th>Item name</th><th style={{ textAlign: "right" }}>On hand</th>
                          <th style={{ textAlign: "right" }}>In WIP</th><th style={{ textAlign: "right" }}>On order</th>
                          <th style={{ width: 160 }}>Disposition</th><th>Notes</th></tr></thead>
                        <tbody>
                          {dispRows.map((r: any) => (
                            <tr key={r[0]}>
                              <td className="pn">{r[0]}</td><td>{r[1]}</td>
                              <td style={{ textAlign: "right" }}>{r[2].toLocaleString()}</td>
                              <td style={{ textAlign: "right" }}>{r[3] || <span className="mut">—</span>}</td>
                              <td style={{ textAlign: "right" }}>{r[4] ? r[4].toLocaleString() : <span className="mut">—</span>}</td>
                              <td><Select style={{ height: 28 }} options={[r[5], "Use up", "Scrap", "Rework", "Return to supplier", "N/A"]} /></td>
                              <td><Input style={{ height: 28 }} placeholder="Optional note" /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="okbox"><CheckCircle2 size={15} />
                      <div><b>All items have a disposition.</b> This satisfies the confirmation on the summary page.</div></div>
                  </>
                );
              })()}
            </div>
          )}

          {tab === "Files" && (() => {
            const isECO010870 = eco.id === "ECO-010870";
            // Seed files vary per change order for demo realism
            const seedFiles: StagedFile[] = eco.id === "ECO-010870"
              ? [{ n: "EOL_Notice_Ag_Kits_2026.pdf", size: "180 KB", fileType: "Reference", visibility: "Internal only" }]
              : eco.id === "DCO-008335"
              ? [{ n: "INSP-2026-0448.pdf", size: "1.2 MB", fileType: "Inspection report", visibility: "Internal only" }]
              : eco.id === "RFD-000912"
              ? [{ n: "solder_mask_dev_cert.pdf", size: "320 KB", fileType: "Certificate", visibility: "Internal only" }]
              : eco.id === "CO-002846"
              ? [
                  { n: "RL-H5A_kit_update_v2.pdf", size: "412 KB", fileType: "Drawing", visibility: "Share with suppliers" },
                  { n: "third_party_BOM_CO002846.xlsx", size: "88 KB", fileType: "Specification", visibility: "Internal only" },
                ]
              : [{ n: "DCR7-23172_request.pdf", size: "240 KB", fileType: "Reference", visibility: "Internal only" }];
            const allFiles = [...seedFiles, ...attachedFiles];
            return (
              <div className="stack" data-test-id="eco-files-tab">
                <div className="bet">
                  <div>
                    <h3>Files on this change</h3>
                    <div className="sub" style={{ marginTop: 3 }}>Reference files support the decision. Implementation files are what manufacturing works from once the change goes effective.</div>
                  </div>
                  <button className="btn pri" onClick={() => setFileModalOpen(true)} data-test-id="attach-files-btn">
                    <Upload size={13} />Attach files
                  </button>
                </div>
                <div className="card" style={{ overflow: "hidden" }}>
                  <table className="tbl">
                    <thead>
                      <tr><th>File</th><th>Purpose</th><th>Version</th><th>Visibility</th><th>Added by</th><th>Added</th><th></th></tr>
                    </thead>
                    <tbody>
                      {allFiles.map((f, k) => (
                        <tr key={k} data-test-id={`eco-file-row-${k}`}>
                          <td>
                            <div className="row" style={{ gap: 9 }}>
                              <span style={{ width: 28, height: 28, borderRadius: 8, background: T.b50, display: "grid", placeItems: "center" }}>
                                <FileText size={14} color={T.brand} />
                              </span>
                              <div>
                                <div style={{ fontWeight: 600 }}>{f.n}</div>
                                <div className="mini">{f.size}</div>
                              </div>
                            </div>
                          </td>
                          <td><Chip k="gray">{f.fileType}</Chip></td>
                          <td>v{k + 1}</td>
                          <td><Chip k="gray">{f.visibility}</Chip></td>
                          <td className="sub">{k < seedFiles.length ? eco.creator : ME.name}</td>
                          <td className="sub">{eco.created || "—"}</td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn gh sm" aria-label="Download" data-test-id={`eco-file-download-${k}`}><Download size={13} /></button>
                          </td>
                        </tr>
                      ))}
                      {allFiles.length === 0 && (
                        <tr data-test-id="eco-files-empty">
                          <td colSpan={7} style={{ textAlign: "center", padding: "24px 12px", color: T.g500 }}>No files attached yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="note">
                  {isECO010870
                    ? "Inactivation change order — drawing updates not required. Obsolescence notice satisfies file audit."
                    : "Files attached here are versioned. Replacing a file keeps the prior version in History."}
                </div>
              </div>
            );
          })()}

          {tab === "Approvals" && (() => {
            const { decidedCount: done, requiredCount: req } = approvalState;
            const pct = req > 0 ? Math.round((done / req) * 100) : 0;
            const groups = [...new Set(APPROVALS.map((x: any) => x.g))];
            return (
              <div className="stack">
                <div className="note"><Info size={13} style={{ verticalAlign: -2 }} /> Suppliers from different companies cannot see each
                  other on this change.</div>

                {/* ---- section one: the approval flow ---- */}
                <div className="sectionhead">
                  <span className="secnum">1</span>
                  <div><b>Approval flow</b>
                    <div className="mini" style={{ marginTop: 2 }}>Functional roles review in parallel. Every required role must decide
                      before document control can sign.</div></div>
                  <div className="row" style={{ marginLeft: "auto", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: T.brand }}>{done} of {req}</div>
                      <div className="mini">decisions in</div>
                    </div>
                    <div className="ring" style={{ background: `conic-gradient(${T.brand} ${pct * 3.6}deg, ${T.g200} 0)` }}>
                      <span>{pct}%</span>
                    </div>
                  </div>
                </div>

                {groups.map((g: any) => {
                  const members = APPROVALS.filter((x: any) => x.g === g);
                  const isCommentsOnly = members[0].req === "Comments only";
                  const gdone = isCommentsOnly || members.some((m: any) => m.st === "approved");
                  const opt = members[0].req === "Optional";
                  return (
                    <div key={g} className={`apgroup ${gdone ? "done" : opt ? "opt" : ""}`}>
                      <div className="apghead">
                        <span className="apgdot">{gdone ? <Check size={11} color="#fff" strokeWidth={3.5} />
                          : opt ? <Ban size={10} color={T.g500} /> : <Clock size={10} color={T.warn} />}</span>
                        <b>{g}</b>
                        <Chip k={isCommentsOnly ? "gray" : members[0].req === "Optional" ? "gray" : "blue"}>{members[0].req}</Chip>
                        {isCommentsOnly ? <Chip k="gray">Comments recorded</Chip> : gdone ? <Chip k="ok">Satisfied</Chip> : opt ? <Chip k="gray">Skipped</Chip> : <Chip k="warn">Waiting</Chip>}
                        <div className="row" style={{ marginLeft: "auto", gap: 5 }}>
                          {members.map((m: any) => (
                            <span key={m.n} className={`ava2 sm ${m.st === "approved" ? "ok" : ""}`} title={`${m.n} — ${m.st}`}>
                              {m.n.split(" ").map((x: any) => x[0]).join("").slice(0, 2)}</span>
                          ))}
                        </div>
                      </div>
                      <table className="tbl">
                        <tbody>
                          {members.map((m: any) => (
                            <tr key={m.n}>
                              <td style={{ width: 34 }}>{m.st === "approved" ? <Check size={14} color={T.ok} strokeWidth={3} />
                                : m.st === "comments" ? <FileText size={13} color={T.g400} />
                                : m.st === "skipped" ? <Ban size={13} color={T.g400} /> : <Circle size={13} color={T.g400} />}</td>
                              <td style={{ fontWeight: 600, width: 190 }}>{m.n}</td>
                              <td style={{ width: 130 }}>{m.st === "approved" ? <Chip k="ok">Approved</Chip>
                                : m.st === "comments" ? <Chip k="gray">Comments recorded</Chip>
                                : m.st === "skipped" ? <Chip k="gray">Skipped</Chip> : <Chip k="warn">Waiting</Chip>}</td>
                              <td className="sub" style={{ width: 170 }}>{m.at || "—"}</td>
                              <td className="sub">{m.cm || <span className="mut">No comment</span>}</td>
                              <td style={{ textAlign: "right", width: 110 }}>
                                {m.st === "pending" && (
                                  <button
                                    className="btn sm"
                                    data-test-id={`remind-btn-${m.n}`}
                                    onClick={() => {
                                      sendReminder(eco.id, m.n)
                                        .then(() => toast.success(`Reminder sent to ${m.n}`))
                                        .catch(() => toast.error(`Failed to send reminder to ${m.n}`))
                                    }}
                                  >
                                    <Bell size={12} />Remind
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                <div className="gatebar">
                  <span className="gateline" />
                  <span className="gatepill"><Clock size={12} />Stage 2 unlocks when every required role above has decided</span>
                  <span className="gateline" />
                </div>

                {/* ---- section two: document control ---- */}
                <div className="sectionhead">
                  <span className="secnum">2</span>
                  <div><b>Document control check</b>
                    <div className="mini" style={{ marginTop: 2 }}>The gatekeeper. Verifies the redline against the description, then
                      releases the change to the effective stage and the SAP write-back.</div></div>
                  <Chip k="gray" icon={Clock}>Locked</Chip>
                </div>

                <div className="apgroup locked">
                  <div className="apghead">
                    <span className="apgdot"><Clock size={10} color={T.g500} /></span>
                    <b>{(ROUTINGS[eco.routing] || []).filter((r: any) => r.stage === 2).map((r: any) => r.g).join(", ") || "Document Control TPS – Livermore"}</b>
                    <Chip k="blue">One or more</Chip>
                    <div className="row" style={{ marginLeft: "auto", gap: 5 }}>
                      {((ROUTINGS[eco.routing] || []).filter((r: any) => r.stage === 2)[0]?.members || [ME.name, "Adam Royce"])
                        .map((m: any) => <span key={m} className="ava2 sm" title={m}>{initials(m)}</span>)}
                    </div>
                  </div>
                  <div style={{ padding: 14 }}>
                    <div className="checklist">
                      {[["Redline matches the description on the summary page", true],
                        ["Compliance tab reviewed for every item", true],
                        ["Files and sourcing checked, or confirmed not required", true],
                        ["Supplier access and notifications set", true],
                        ["Inventory disposition filled for all items", false]].map(([l, ok2]: any) => (
                        <label key={l} className="row" style={{ gap: 9 }}>
                          <input type="checkbox" defaultChecked={ok2} disabled />
                          <span style={{ fontSize: 13, color: ok2 ? T.g900 : T.g600 }}>{l}</span>
                        </label>
                      ))}
                    </div>
                    <div className="bet" style={{ marginTop: 14 }}>
                      <span className="mini">Four of five checks pass. The last one opens once stage 1 clears.</span>
                      <button className="btn ok" disabled><Check size={13} />Sign off and release</button>
                    </div>
                  </div>
                </div>

                <div className="aibox">
                  <div className="bet">
                    <div className="row"><Sparkles size={15} color={T.vio} />
                      <div><b>Pre-approval analysis</b>
                        <div className="sub" style={{ marginTop: 2 }}>
                          Every check an approver would do by hand, run before they open the change. They confirm the analysis instead of
                          repeating it — and can always disagree with it.
                        </div>
                      </div>
                    </div>
                    <button className="btn" onClick={() => setModal("analysis")}>Open analysis</button>
                  </div>
                </div>
              </div>
            );
          })()}

          {tab === "Supplier access" && (() => {
            const isECO010870 = eco.id === "ECO-010870";
            const samplePns = isECO010870
              ? ["01-080401-03", "04-080401-10", "04-080401-11", "05-080401-01LF"]
              : ["1003140-01", "1002260-01", "1006394-01", "2505-0103"];
            return (
              <div className="stack">
                <div className="bet">
                  <div><h3>Suppliers on this change</h3>
                    <div className="sub" style={{ marginTop: 3 }}>Derived from the sourcing records of the items on the change. A part can be
                      dual sourced, so more than one supplier can appear for the same item.</div></div>
                  <button className="btn pri" onClick={() => setModal("share")}><Plus size={13} />Share with suppliers</button>
                </div>
                {shared.length === 0 ? (
                  <Empty icon={Users} title="Not shared with any supplier yet"
                    body="You can share at any point before the change completes. Suppliers only ever see their own parts."
                    action={<button className="btn" onClick={() => setModal("share")}>Choose suppliers</button>} />
                ) : (
                  <table className="tbl">
                    <thead><tr><th>Supplier</th><th>Parts they supply</th><th>Access</th><th>Notified on</th><th>Added by</th><th></th></tr></thead>
                    <tbody>
                      {suppliersFor(samplePns)
                        .filter((f: any) => shared.includes(f.n)).map((f: any) => (
                        <tr key={f.n}>
                          <td style={{ fontWeight: 600 }}>{f.n}</td>
                          <td><div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
                            {f.parts.map((pn: any) => <span key={pn} className="chip c-blue">{pn}</span>)}</div></td>
                          <td><Chip k="gray">View only</Chip></td>
                          <td className="sub">Change complete</td>
                          <td className="sub">{ME.name}</td>
                          <td style={{ textAlign: "right" }}>
                            <button className="btn gh sm" onClick={() => setShared(shared.filter((x: any) => x !== f.n))}><Trash2 size={12} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="note">
                  {isECO010870
                    ? "Inactivation change sharing: external suppliers are notified upon ECO completion regarding obsolete parts."
                    : "1003140-01 is a sales kit with no sourcing record of its own, so sharing is driven by its components."}
                </div>
              </div>
            );
          })()}

          {tab === "Notifications" && (() => {
            const recipients = notificationRecipientsFor(eco);
            return (
              <div className="stack">
                <div className="bet">
                  <div><h3>{`${recipients.length} users will be notified of status changes`}</h3>
                    <div className="sub" style={{ marginTop: 2 }}>Employees and partners are notified on status change. Suppliers are notified only when the change completes.</div></div>
                  <div className="row"><button className="btn sm"><Plus size={12} />Add</button><button className="btn sm gh"><Trash2 size={12} /></button></div>
                </div>
                <div className="card" style={{ overflow: "hidden" }}>
                  <table className="tbl">
                    <thead><tr><th style={{ width: 26 }}></th><th>#</th><th>Name</th><th>Reason for notification</th><th>Notify on</th></tr></thead>
                    <tbody>
                      {recipients.map((r: any, k: any) => (
                        <tr key={r.name}><td><input type="checkbox" defaultChecked /></td><td>{k + 1}</td>
                          <td className="lnk">{r.name}</td>
                          <td className="sub">{r.reason}</td>
                          <td><Chip k="gray">{r.notifyOn}</Chip></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mini">Showing {recipients.length} of {recipients.length}</div>
              </div>
            );
          })()}

          {tab === "History" && (
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="tbl">
                <thead><tr><th style={{ width: 170 }}>When</th><th style={{ width: 180 }}>Who</th><th>Activity</th></tr></thead>
                <tbody>
                  {HISTORY.map((h: any, k: any) => (
                    <tr key={k}><td className="sub">{h.t}</td><td style={{ fontWeight: 600 }}>{h.w}</td><td>{h.a}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
      {modal === "share" && (
        <Modal title="Share this change with suppliers" wide onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn pri" style={{ marginLeft: "auto" }} disabled={!shareDraft.length}
              onClick={() => { setShared(shareDraft); setModal(null); }}>
              <Check size={13} />Share with {shareDraft.length || ""} supplier{shareDraft.length === 1 ? "" : "s"}</button></>}>
          <SupplierShare pns={["1003140-01", "1002260-01", "1002261-01", "1005393-01", "1006394-01", "2505-0103", "9060-1319"]}
            value={shareDraft} onChange={setShareDraft} />
        </Modal>
      )}
      <FileUploadModal
        open={fileModalOpen}
        onClose={() => setFileModalOpen(false)}
        onAttach={(files) => setAttachedFiles((prev) => [...prev, ...files])}
        context="this change order"
      />
      {modal === "cancelEco" && (
        <Modal title="Cancel this change" onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Keep it open</button>
            <button className="btn dan" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>
              <Ban size={13} />Cancel change</button></>}>
          <div className="warnbox" style={{ marginBottom: 12 }}>Cancelling stops routing and releases every item on this change.
            The record stays in history and cannot be reopened.</div>
          <Field label="Reason"><Select options={["Superseded by another change", "Raised in error", "No longer required",
            "Merged into another change", "Other"]} /></Field>
          <div style={{ height: 12 }} />
          <Field label="Notes"><textarea className="inp" rows={3} /></Field>
        </Modal>
      )}
      {modal === "approve" && (
        <Modal title="Approve this change" onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn ok" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}><Check size={13} />Approve</button></>}>
          <Field label="Comments (optional)"><textarea className="inp" rows={3} placeholder="Anything the next approver or document control should know" /></Field>
          <div className="note" style={{ marginTop: 12 }}>You are approving for <b>Construction Engineering</b>. This role needs one or more approvals; one is already in.</div>
        </Modal>
      )}
      {modal === "reject" && (
        <Modal title="Reject this change" onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn dan" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}><X size={13} />Reject and stop routing</button></>}>
          <div className="warnbox" style={{ marginBottom: 12 }}>Rejecting stops routing for everyone. Document control will withdraw the change to Open to rework it.</div>
          <Field label="Reason"><Select options={["Redline does not match the description", "Drawing or file incorrect", "Missing tolerance or evidence",
            "Wrong supplier selected", "Item should not be on this change", "Other"]} /></Field>
          <div style={{ height: 12 }} />
          <Field label="Notes for document control" hint="These notes go into the rejection email and sit under Decisions.">
            <textarea className="inp" rows={4} /></Field>
        </Modal>
      )}
      {modal === "withdraw" && (
        <Modal title="Withdraw to Open" onClose={() => setModal(null)}
          foot={<><button className="btn" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn pri" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}><CornerUpLeft size={13} />Withdraw</button></>}>
          <p className="sub" style={{ marginTop: 0 }}>Items and redlines can only be edited while a change is Open. Withdrawing returns it to the requester
            and document control for rework. Prior decisions stay in History.</p>
          <Field label="Who picks this up?">
            <Select options={["Document control can resolve it (administrative)", "Return to requester — Brian Johmann (engineering)", "Both"]} /></Field>
          <div style={{ height: 12 }} />
          <label className="row"><input type="checkbox" defaultChecked /> Email the requester with the rejection notes</label>
        </Modal>
      )}
      {modal === "complete" && (
        <Modal title="Verify SAP write-back" onClose={() => setModal(null)} wide
          foot={<><button className="btn" onClick={() => setModal(null)}>Close</button>
            <button className="btn pri" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}
              disabled={!syncing}><CheckCircle2 size={13} />Move to Complete</button></>}>
          <div className="bet" style={{ marginBottom: 12 }}>
            <div className="row"><Database size={15} color={T.brand} /><b>SAP ECC · plant 1210</b></div>
            <button className="btn sm" onClick={() => setSyncing(true)}><RefreshCw size={12} />Re-check now</button>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead><tr><th>Item</th><th>Field</th><th>Topcon PLM</th><th>SAP</th><th>Status</th></tr></thead>
              <tbody>
                {[["1007886-02", "Material status", "20 – ACTIVE", "20 – ACTIVE"],
                  ["1007886-02", "BOM component qty", "4 EA", "4 EA"],
                  ["1002260-01", "Material status", "20 – ACTIVE", "20 – ACTIVE"],
                  ["9060-1319", "BOM usage", "Removed", syncing ? "Removed" : "Pending"]].map((r: any, k: any) => (
                  <tr key={k}><td className="pn">{r[0]}</td><td className="sub">{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td>
                    <td>{r[3] === "Pending" ? <Chip k="warn">Waiting</Chip> : <Chip k="ok">Matched</Chip>}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            {syncing ? "All fields matched. The change can be moved to Complete."
              : "One field is still transferring. Re-check in a few minutes — transfer usually takes 15 to 30 minutes."}
          </div>
        </Modal>
      )}
      {modal === "analysis" && (() => {
        const isECO010870 = eco.id === "ECO-010870";
        const rows = isECO010870
          ? [
              [true, "Obsolescence verification", "No TPS open demand found in last 90 days across all 129 items."],
              [true, "Status transition", "All 129 items transition from In Production to Status 50 (Discontinued/Inactive)."],
              [true, "Where used cascade", "Unique child components correctly scoped into this change; no parent outside the change is broken."],
              [true, "Compliance & files", "Inactivation change order — drawing updates not required. Obsolescence notice attached."],
              [false, "Downstream service impact", "Three service spare kits inherit discontinued status — verify no open warranty commitments."],
              [true, "Duplicate changes", "No conflicting open changes found on these part numbers."],
            ]
          : [
              [true, "Redline matches the description", "Description lists 2 additions and 1 deletion. Redline shows exactly those three lines."],
              [true, "Revision roll is correct", "Rev B → C. Last production revision was B, no open revisions elsewhere."],
              [true, "Compliance", "All BOM children are RoHS compliant, so the top level is compliant. No certificate required."],
              [false, "Where used", "1003140-01 appears in 3 sales kits. Two of them still reference the removed tape 9060-1319 in their assembly instructions."],
              [true, "Sourcing and files", "Sales BOM — no drawings or sourcing records expected."],
              [false, "Cost", "Net component cost rises 1.8%. Description states no list price update is required — confirm with product management."],
              [true, "Duplicate changes", "No other open change touches these items."],
            ];

        return (
          <Modal title={`Pre-approval analysis — ${eco.id}`} onClose={() => setModal(null)} wide
            foot={<><Chip k="vio">Advisory — approvers decide</Chip>
              <button className="btn pri" style={{ marginLeft: "auto" }} onClick={() => setModal(null)}>Attach to change</button></>}>
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="tbl">
                <thead><tr><th style={{ width: 26 }}></th><th>Check</th><th>Finding</th></tr></thead>
                <tbody>
                  {rows.map(([ok, t, d]: any, k: any) => (
                    <tr key={k}><td>{ok ? <Check size={13} color={T.ok} /> : <AlertTriangle size={13} color={T.warn} />}</td>
                      <td style={{ fontWeight: 600 }}>{t}</td><td className="sub">{d}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="warnbox" style={{ marginTop: 12 }}>
              {isECO010870
                ? "One item needs a human: confirm service spare kits have no pending warranty back-orders. All other checks passed."
                : "Two items need a human: the downstream work instructions and the cost note. Everything else is verified."}
            </div>
          </Modal>
        );
      })()}
      {/* Approver reject reason modal */}
      {rejectModal && (
        <Modal
          title="Reject this change"
          onClose={() => { setRejectModal(false); setRejectReason(''); }}
          foot={
            <>
              <button className="btn" onClick={() => { setRejectModal(false); setRejectReason(''); }}>Cancel</button>
              <button
                className="btn dan"
                style={{ marginLeft: "auto" }}
                disabled={!rejectReason.trim() || isRejecting}
                onClick={handleReject}
                data-test-id="approver-reject-confirm-btn"
              >
                {isRejecting ? <><Loader2 size={13} className="spin" />Rejecting…</> : <><X size={13} />Submit rejection</>}
              </button>
            </>
          }
        >
          <div className="warnbox" style={{ marginBottom: 14 }}>
            Your rejection will be sent to Document Control. They will review your notes and determine next steps.
          </div>
          <Field label="Reason for rejection">
            <Select
              value={rejectReason}
              onChange={(e: any) => setRejectReason(e.target.value)}
              options={[
                "",
                "Redline does not match the description",
                "Drawing or file incorrect",
                "Missing tolerance or evidence",
                "Wrong supplier selected",
                "Item should not be on this change",
                "Impact not fully assessed",
                "Requires further review",
                "Other",
              ]}
              data-test-id="approver-reject-reason-select"
            />
          </Field>
          <div style={{ height: 12 }} />
          <Field label="Additional notes (optional)" hint="These notes go to Document Control and appear under Decisions.">
            <textarea
              className="inp"
              rows={4}
              placeholder="Explain why you are rejecting — what needs to change before you can approve…"
              data-test-id="approver-reject-notes-input"
            />
          </Field>
        </Modal>
      )}

      {/* ── Comment Drawer ── */}
      {commentDrawerOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 49, background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setCommentDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            style={{
              position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
              width: 420, background: T.g25, boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
              display: 'flex', flexDirection: 'column',
            }}
            data-test-id="comment-drawer"
            aria-label="Add comment"
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: `1px solid ${T.g200}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>Add a comment</span>
              </div>
              <button className="btn gh sm" onClick={() => setCommentDrawerOpen(false)} aria-label="Close" data-test-id="comment-drawer-close">
                <X size={14} />
              </button>
            </div>

            {/* Past comments trail */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(eco.comments ?? []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: T.g400, fontSize: 13 }}>
                  No comments yet — be the first to leave a note.
                </div>
              ) : (
                [...(eco.comments ?? [])].reverse().map((c) => (
                  <div key={c.id} style={{ padding: '12px 14px', background: T.g50, borderRadius: 8, border: `1px solid ${T.g200}` }} data-test-id={`comment-item-${c.id}`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{c.author}</span>
                      <span className="sub" style={{ fontSize: 11 }}>{c.timestamp}</span>
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{c.message}</div>
                  </div>
                ))
              )}
            </div>

            {/* Input area */}
            <div style={{ borderTop: `1px solid ${T.g200}`, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Field label="Your name">
                <input
                  className="inp"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                  placeholder="Your name"
                  data-test-id="comment-author-input"
                />
              </Field>
              <Field label="Comment">
                <textarea
                  className="inp"
                  rows={4}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={`Leave a note on ${eco.id}…`}
                  data-test-id="comment-text-input"
                />
              </Field>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setCommentDrawerOpen(false)} data-test-id="comment-cancel-btn">Cancel</button>
                <button
                  className="btn pri"
                  disabled={!commentText.trim() || !commentAuthor.trim() || isSavingComment}
                  onClick={handleSaveComment}
                  data-test-id="comment-save-btn"
                >
                  {isSavingComment ? <><Loader2 size={13} className="spin" />Saving…</> : <>Post comment</>}
                </button>
              </div>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

export { EcoDetail }


