import { Card } from '@/components/primitives/Card'
import { Chip, stageChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Kpi } from '@/components/primitives/Kpi'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { useAllChangeOrders, deriveCoKpis, CO_STAGES, ChangeOrder } from '@/data/changeOrders'
import { T } from '@/theme/tokens'
import { AlertTriangle, Clock, Database, Eye, Filter, GitPullRequest, LayoutGrid, List, Pencil, Plus } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/* =========================== ECO MASTER ============================= */

function EcoList({ go, initialFilter, onInspect, inspectedId, railOpen = false, renderHeaderActions, role = 'unknown', currentUserName = '' }: { go: any; initialFilter?: any; onInspect?: any; inspectedId?: any; railOpen?: boolean; renderHeaderActions?: () => React.ReactNode; role?: string; currentUserName?: string }) {
  const isApproverRole = role === 'approver'
  // Approvers default to "Approval"; DC defaults to "Needs me"
  const [f, setF] = useState(initialFilter || (isApproverRole ? "Approval" : "Needs me"));
  const [q, setQ] = useState("");
  const [view, setView] = useState("table");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStages, setSelectedStages] = useState<string[]>(
    initialFilter && (CO_STAGES as readonly string[]).includes(initialFilter) ? [initialFilter] : []
  );
  const [ecoPage, setEcoPage] = useState(0);
  // Approvers see Approval first, then All; DC sees the full set
  const filters = isApproverRole ? ["Approval", "All"] : ["Needs me", "Open", "All"];

  // Backend data
  const { data: allOrders, loading: ordersLoading } = useAllChangeOrders();
  const kpis = useMemo(() => deriveCoKpis(allOrders), [allOrders]);

  const isNeedsMe = (e: ChangeOrder) => e.awaitingMe || e.stage === "Rejected";

  // For Approvers: show only ECOs where the current user is listed in the approvalsJson
  // (as primary approver or in the others array), plus Rejected ones they acted on.
  // Falls back to all Approval-stage ECOs when the username is not yet resolved.
  const visibleOrders = useMemo(() => {
    if (!isApproverRole) return allOrders
    if (!currentUserName) {
      return allOrders.filter((e) => e.stage === 'Approval' || e.stage === 'Rejected')
    }
    return allOrders.filter((e) => {
      if (e.stage === 'Rejected') return true
      return e.approvals.some(
        (a) => a.approver === currentUserName || (a.others ?? []).includes(currentUserName)
      )
    })
  }, [allOrders, isApproverRole, currentUserName])

  const stageStats: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    CO_STAGES.forEach((st) => { map[st] = 0; });
    visibleOrders.forEach((e) => { if (e.stage) map[e.stage] = (map[e.stage] ?? 0) + 1; });
    return map;
  }, [visibleOrders]);

  const needsMeCount = useMemo(() => visibleOrders.filter(isNeedsMe).length, [visibleOrders]);
  const openCount = useMemo(() => visibleOrders.filter((e) => e.stage !== "Complete").length, [visibleOrders]);

  const count = (x: string) => {
    if (x === "Needs me") return needsMeCount;
    if (x === "Open") return openCount;
    if (x === "All") return visibleOrders.length;
    if (x === "Approval") return stageStats["Approval"] ?? 0;
    return stageStats[x] ?? 0;
  };

  const rows = useMemo(() => visibleOrders.filter((e) => {
    if (f === "Needs me" && !isNeedsMe(e)) return false;
    if (f === "Open" && e.stage === "Complete") return false;
    if (f === "Approval" && e.stage !== "Approval") return false;
    if (selectedStages.length > 0 && !selectedStages.includes(e.stage)) return false;
    if (q !== "" && !(e.coId + e.title + e.creator).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [visibleOrders, f, selectedStages, q]);

  React.useEffect(() => {
    const handleKeyDown = (ev: any) => {
      const activeTag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag || "")) return;
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        const visibleRows = rows.slice(ecoPage * PAGE_SIZE, (ecoPage + 1) * PAGE_SIZE);
        if (!visibleRows.length) return;
        const curIdx = visibleRows.findIndex((r) => r.coId === inspectedId);
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          const nextIdx = curIdx === -1 ? 0 : Math.min(curIdx + 1, visibleRows.length - 1);
          onInspect?.(visibleRows[nextIdx].coId);
        } else if (ev.key === "ArrowUp") {
          ev.preventDefault();
          const nextIdx = curIdx === -1 ? 0 : Math.max(curIdx - 1, 0);
          onInspect?.(visibleRows[nextIdx].coId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, inspectedId, onInspect, ecoPage]);


  return (
    <div className="stack" data-test-id="eco-list-page">
      <div className="bet" data-test-id="eco-list-header">
        <div>
          <div className="crumb">Changes</div>
          <h1>{isApproverRole ? "My Changes" : "Change Orders"}</h1>
          <div className="sub" style={{ marginTop: 4 }}>
            {isApproverRole
              ? "Changes in your approval queue — awaiting your review"
              : "Track and manage engineering change orders across all product lines"}
          </div>
        </div>
        <div className="row">
          {/* Only DCs (and unknown/dev) can create new change orders */}
          {!isApproverRole && (
            <button className="btn pri" onClick={() => go({ page: "eco-new" })} data-test-id="eco-new-btn">
              <Plus size={13} strokeWidth={2} />New Change Order
            </button>
          )}
          {renderHeaderActions?.()}
        </div>
      </div>

      {/* KPI cards — only for DC; Approver sees a focused pending-count banner instead */}
      {isApproverRole ? (
        <div className="card" style={{ padding: "14px 20px", display: "flex", gap: 24, alignItems: "center" }} data-test-id="eco-approver-banner">
          <div>
            <span style={{ fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{needsMeCount}</span>
            <span className="sub" style={{ marginLeft: 8, fontSize: 13 }}>change{needsMeCount !== 1 ? "s" : ""} awaiting your review</span>
          </div>
        </div>
      ) : (
        <div className="grid4" data-test-id="eco-kpis">
          {ordersLoading ? (
            <>
              <Skeleton className="h-20 rounded-lg" data-test-id="eco-kpi-skeleton-1" />
              <Skeleton className="h-20 rounded-lg" data-test-id="eco-kpi-skeleton-2" />
              <Skeleton className="h-20 rounded-lg" data-test-id="eco-kpi-skeleton-3" />
              <Skeleton className="h-20 rounded-lg" data-test-id="eco-kpi-skeleton-4" />
            </>
          ) : (
            <>
              <Kpi label="Open / Submit" value={kpis.open + kpis.submit} icon={Pencil} tint={T.slateBg} bd={T.slateBd} tone={T.slate}
                onClick={() => { setF("All"); setSelectedStages(["Open", "Submit"]); }} data-test-id="eco-kpi-open" />
              <Kpi label="In approval" value={kpis.approval} icon={Clock} tint={T.warnBg} bd={T.warnBd} tone={T.warn}
                onClick={() => { setF("All"); setSelectedStages(["Approval"]); }} data-test-id="eco-kpi-approval" />
              <Kpi label="Effective / Complete" value={kpis.effective + kpis.complete} icon={Database} tint={T.vioBg} bd={T.vioBd} tone={T.vio}
                onClick={() => { setF("All"); setSelectedStages(["Effective", "Complete"]); }} data-test-id="eco-kpi-effective" />
              <Kpi label="Rejected" value={kpis.rejected} icon={AlertTriangle} tint={T.badBg} bd={T.badBd} tone={T.bad}
                onClick={() => { setF("All"); setSelectedStages(["Rejected"]); }} data-test-id="eco-kpi-rejected" />
            </>
          )}
        </div>
      )}

      <Toolbar q={q} setQ={setQ} placeholder="Search change or title"
          segs={filters} seg={f} setSeg={(newF: any) => { setF(newF); }} count={count}
          right={<>
            <div style={{ position: "relative" }}>
              <button
                className={`btn ${selectedStages.length > 0 ? "pri" : ""}`}
                onClick={() => setFilterOpen((prev: any) => !prev)}
                data-test-id="eco-filters-btn"
              >
                <Filter size={13} strokeWidth={2} />Filters
                {selectedStages.length > 0 && (
                  <span style={{
                    marginLeft: 4, background: "rgba(255,255,255,0.25)",
                    borderRadius: 10, padding: "0 6px", fontSize: 11
                  }}>
                    {selectedStages.length}
                  </span>
                )}
              </button>
              {filterOpen && (
                <>
                  <div
                    style={{ position: "fixed", inset: 0, zIndex: 40 }}
                    onClick={() => setFilterOpen(false)}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      zIndex: 50,
                      width: 240,
                      background: "#fff",
                      borderRadius: 10,
                      border: `1px solid ${T.g200}`,
                      boxShadow: "0 1px 2px rgba(2,42,66,.05), 0 10px 26px -14px rgba(2,42,66,.20)",
                      padding: 12,
                    }}
                    data-test-id="eco-filters-dropdown"
                  >
                  <div className="bet" style={{ marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${T.g100}` }}>
                    <b style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: T.g700 }}>Stage</b>
                    {selectedStages.length > 0 && (
                      <button
                        className="btn gh sm"
                        style={{ height: 20, padding: "0 4px", fontSize: 11, color: T.brand }}
                        onClick={() => setSelectedStages([])}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {CO_STAGES.map((st) => {
                      const checked = selectedStages.includes(st);
                      const stCount = stageStats[st] ?? 0;
                      return (
                        <label
                          key={st}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: 13,
                            cursor: "pointer",
                            padding: "3px 4px",
                            borderRadius: 6,
                          }}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedStages((prev: any) =>
                                  checked ? prev.filter((s: any) => s !== st) : [...prev, st]
                                );
                              }}
                            />
                            {st}
                          </span>
                          <span className="mini" style={{ color: T.g600, fontVariantNumeric: "tabular-nums" }}>
                            {stCount}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                </>
              )}
            </div>
            <div className="seg">
              <button className={view === "table" ? "on" : ""} onClick={() => setView("table")} title="Table"><List size={14} /></button>
              <button className={view === "card" ? "on" : ""} onClick={() => setView("card")} title="Cards"><LayoutGrid size={14} /></button>
            </div>
          </>} />

      <Card pad={false}>
        {ordersLoading ? (
          <div style={{ padding: "20px" }} data-test-id="eco-list-loading">
            {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-12 mb-2" />)}
          </div>
        ) : rows.length === 0 ? (
          <Empty icon={GitPullRequest} title={`No matching change orders`}
            body="Nothing sits in this view right now. Adjust your search or filters, or start a change."
            action={<button className="btn pri" onClick={() => go({ page: "eco-new" })}><Plus size={13} />New Change Order</button>} />
        ) : view === "table" ? (
          <div className="scrollx">
            <table className="tbl">
              <thead><tr>
                <th>Change</th>
                {!railOpen && <th>Category</th>}
                {!railOpen && <th>Routing</th>}
                {!railOpen && <th>Division</th>}
                <th style={{ textAlign: "right" }} title="Items on the change / requested modifications">Items / Mods</th>
                <th>Stage</th>
                {!railOpen && <th>Creator</th>}
                <th>Created</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rows.slice(ecoPage * PAGE_SIZE, (ecoPage + 1) * PAGE_SIZE).map((e) => (
                  <tr
                    key={e.id}
                    className={inspectedId === e.coId ? "inspected-row" : ""}
                    data-test-id={`eco-row-${e.id}`}
                  >
                    <td style={railOpen ? { maxWidth: 220 } : undefined}>
                      <a className="pn" onClick={() => go({ page: "eco", id: e.coId })}>{e.coId}</a>
                      <div
                        className="sub"
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: railOpen ? 210 : undefined,
                        }}
                        title={e.title}
                      >
                        {e.title}
                      </div>
                    </td>
                    {!railOpen && <td className="sub">{e.type}</td>}
                    {!railOpen && <td>{e.routing}</td>}
                    {!railOpen && <td><Chip k={e.div === "AG" ? "teal" : "gray"}>{e.div}</Chip></td>}
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{e.itemCount}<span className="mut"> / {e.modCount}</span></td>
                    <td style={{ whiteSpace: "nowrap" }}>{stageChip(e.stage)}</td>
                    {!railOpen && <td className="sub">{e.creator}</td>}
                    <td className="sub" style={{ whiteSpace: "nowrap" }}>{e.created}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn gh sm"
                        title="Inspect change"
                        data-test-id={`inspect-btn-${e.id}`}
                        onClick={(ev: any) => {
                          ev.stopPropagation();
                          onInspect?.(e.coId);
                        }}
                      >
                        <Eye size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="cb grid3">
            {rows.slice(0, 12).map((e) => (
              <button key={e.id} className="card" style={{ padding: 15, textAlign: "left" }} onClick={() => go({ page: "eco", id: e.coId })}
                data-test-id={`eco-card-${e.id}`}>
                <div className="bet"><span className="pn">{e.coId}</span>{stageChip(e.stage)}</div>
                <div style={{ fontWeight: 600, margin: "9px 0 4px" }}>{e.title}</div>
                <div className="sub" style={{ minHeight: 34, lineHeight: 1.5 }}>{e.desc.slice(0, 76)}…</div>
                <div className="row" style={{ marginTop: 12, gap: 8, paddingTop: 10, borderTop: `1px solid ${T.g100}` }}>
                  <Chip k={e.div === "AG" ? "teal" : "gray"}>{e.div}</Chip>
                  <span className="mini">{e.itemCount} items</span>
                  <span className="mini" style={{ marginLeft: "auto" }}>{e.created}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        <Pagination total={rows.length} page={ecoPage} setPage={(p: any) => { setEcoPage(p); }} />
      </Card>
    </div>
  );
}

export { EcoList }


