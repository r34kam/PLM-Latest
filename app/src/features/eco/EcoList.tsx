import { Card } from '@/components/primitives/Card'
import { Chip, stageChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Kpi } from '@/components/primitives/Kpi'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { ECOS, STAGES } from '@/domain/ecos'
import { deriveApprovalState } from '@/domain/routings'
import { ME } from '@/domain/session'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import { AlertTriangle, Clock, Database, Download, Eye, Filter, GitPullRequest, LayoutGrid, List, Pencil, Plus } from 'lucide-react'
import React, { useMemo, useState } from 'react'

/* =========================== ECO MASTER ============================= */

function EcoList({ go, initialFilter, onInspect, inspectedId, railOpen = false, renderHeaderActions }: { go: any; initialFilter?: any; onInspect?: any; inspectedId?: any; railOpen?: boolean; renderHeaderActions?: () => React.ReactNode }) {
  const [f, setF] = useState(initialFilter || "Needs me");
  const [q, setQ] = useState("");
  const [view, setView] = useState("table");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedStages, setSelectedStages] = useState(
    initialFilter && STAGES.includes(initialFilter) ? [initialFilter] : []
  );
  const [selectedIds, setSelectedIds] = useState<any[]>([]);
  const [ecoPage, setEcoPage] = useState(0);
  const filters = ["Needs me", "Open", "All"];

  const isNeedsMe = (e: any) => {
    if (e.stage === "Rejected") return true;
    if (e.awaitingMe) return true;
    const { open } = deriveApprovalState(e);
    return open.some((r: any) => r.n === ME.name || (r.others && r.others.includes(ME.name)));
  };

  const stageStats: Record<string, any> = useMemo(() => {
    const map: Record<string, any> = {};
    STAGES.forEach((st: any) => { map[st] = 0; });
    ECOS.forEach((e: any) => {
      const appState = deriveApprovalState(e);
      if (appState && e.stage) {
        map[e.stage] = (map[e.stage] || 0) + 1;
      }
    });
    return map;
  }, []);

  const needsMeCount = useMemo(() => ECOS.filter(isNeedsMe).length, []);
  const openCount = useMemo(() => ECOS.filter((e: any) => e.stage !== "Complete").length, []);

  const count = (x: any) => {
    if (x === "Needs me") return needsMeCount;
    if (x === "Open") return openCount;
    if (x === "All") return ECOS.length;
    return stageStats[x] ?? ECOS.filter((e: any) => e.stage === x).length;
  };

  const rows = ECOS.filter((e: any) => {
    if (f === "Needs me" && !isNeedsMe(e)) return false;
    if (f === "Open" && e.stage === "Complete") return false;
    if (selectedStages.length > 0 && !selectedStages.includes(e.stage)) return false;
    if (q !== "" && !(e.id + e.title + e.creator).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  React.useEffect(() => {
    const handleKeyDown = (ev: any) => {
      const activeTag = document.activeElement?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(activeTag || "")) {
        return;
      }
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
        const visibleRows = rows.slice(ecoPage * PAGE_SIZE, (ecoPage + 1) * PAGE_SIZE);
        if (!visibleRows.length) return;
        const curIdx = visibleRows.findIndex((r: any) => r.id === inspectedId);
        if (ev.key === "ArrowDown") {
          ev.preventDefault();
          const nextIdx = curIdx === -1 ? 0 : Math.min(curIdx + 1, visibleRows.length - 1);
          onInspect?.(visibleRows[nextIdx].id);
        } else if (ev.key === "ArrowUp") {
          ev.preventDefault();
          const nextIdx = curIdx === -1 ? 0 : Math.max(curIdx - 1, 0);
          onInspect?.(visibleRows[nextIdx].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, inspectedId, onInspect]);

  const allPageIds = rows.slice(ecoPage * PAGE_SIZE, (ecoPage + 1) * PAGE_SIZE).map((e: any) => e.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id: any) => selectedIds.includes(id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds((prev: any) => prev.filter((id: any) => !allPageIds.includes(id)));
    } else {
      setSelectedIds((prev: any) => Array.from(new Set([...prev, ...allPageIds])));
    }
  };

  const toggleSelect = (id: any) => {
    setSelectedIds((prev: any) =>
      prev.includes(id) ? prev.filter((x: any) => x !== id) : [...prev, id]
    );
  };

  const exportSelected = () => {
    const toExport = ECOS.filter((e: any) => selectedIds.includes(e.id));
    const header = "Change,Title,Category,Routing,Division,Items,Mods,Stage,Creator,Created";
    const body = toExport.map((e: any) =>
      `"${e.id}","${e.title.replace(/"/g, '""')}","${e.cat}","${e.routing}","${e.div}",${e.items},${e.mods},"${e.stage}","${e.creator}","${e.created}"`
    ).join("\n");
    downloadFile("change-orders-selected.csv", header + "\n" + body);
  };

  return (
    <div className="stack" data-test-id="eco-list-page">
      <div className="bet">
        <div>
          <div className="crumb">Changes</div>
          <h1>Change orders</h1>
        </div>
        <div className="row">
          <button className="btn pri" onClick={() => go({ page: "eco-new" })}><Plus size={13} strokeWidth={2} />New change order</button>
          {renderHeaderActions?.()}
        </div>
      </div>

      <div className="grid4">
        <Kpi label="Open in workspace" value={stageStats["Open"] ?? ECOS.filter((e: any) => e.stage === "Open").length} note="Editable" icon={Pencil} tint={T.slateBg} bd={T.slateBd} tone={T.slate}
          onClick={() => { setF("Open"); setSelectedStages(["Open"]); }} />
        <Kpi label="In approval" value={stageStats["Approval"] ?? ECOS.filter((e: any) => e.stage === "Approval").length} note="Average 3.2 days in stage" icon={Clock} tint={T.warnBg} bd={T.warnBd} tone={T.warn}
          onClick={() => { setF("All"); setSelectedStages(["Approval"]); }} />
        <Kpi label="Effective this month" value={(stageStats["Effective"] || 0) + (stageStats["Complete"] || 0)} note="12 more than August" icon={Database} tint={T.vioBg} bd={T.vioBd} tone={T.vio}
          onClick={() => { setF("All"); setSelectedStages(["Effective"]); }} />
        <Kpi label="Rejected" value={stageStats["Rejected"] ?? ECOS.filter((e: any) => e.stage === "Rejected").length} note="Held by document control" icon={AlertTriangle} tint={T.badBg} bd={T.badBd} tone={T.bad}
          onClick={() => { setF("All"); setSelectedStages(["Rejected"]); }} />
      </div>

      <Card pad={false}>
        <Toolbar q={q} setQ={setQ} placeholder="Search change or title"
          segs={filters} seg={f} setSeg={(newF: any) => { setF(newF); }} count={count}
          selected={selectedIds.length}
          onClearSel={() => setSelectedIds([])}
          bulk={
            <button className="btn sm" onClick={exportSelected} data-test-id="export-selected-btn">
              <Download size={12} />Export selected
            </button>
          }
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
                    {STAGES.map((st: any) => {
                      const checked = selectedStages.includes(st);
                      const stCount = stageStats[st] ?? ECOS.filter((e: any) => e.stage === st).length;
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

        {rows.length === 0 ? (
          <Empty icon={GitPullRequest} title={`No matching change orders`}
            body="Nothing sits in this view right now. Adjust your search or filters, or start a change."
            action={<button className="btn pri" onClick={() => go({ page: "eco-new" })}><Plus size={13} />New change order</button>} />
        ) : view === "table" ? (
          <div className="scrollx">
            <table className="tbl">
              <thead><tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                </th>
                <th>Change</th>
                {!railOpen && <th>Category</th>}
                {!railOpen && <th>Routing</th>}
                {!railOpen && <th>Division</th>}
                <th style={{ textAlign: "right" }} title="Items on the change / requested modifications">Items / mods</th>
                <th>Stage</th>
                {!railOpen && <th>Creator</th>}
                <th>Created</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rows.slice(ecoPage * PAGE_SIZE, (ecoPage + 1) * PAGE_SIZE).map((e: any) => (
                  <tr
                    key={e.id}
                    className={`${selectedIds.includes(e.id) ? "sel" : ""} ${inspectedId === e.id ? "inspected-row" : ""}`}
                    data-test-id={`eco-row-${e.id}`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(e.id)}
                        onChange={() => toggleSelect(e.id)}
                      />
                    </td>
                    <td style={railOpen ? { maxWidth: 220 } : undefined}>
                      <a className="pn" onClick={() => go({ page: "eco", id: e.id })}>{e.id}</a>
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
                    {!railOpen && <td className="sub">{e.cat.split(":")[0]}</td>}
                    {!railOpen && <td>{e.routing}</td>}
                    {!railOpen && <td><Chip k={e.div === "AG" ? "teal" : "blue"}>{e.div}</Chip></td>}
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{e.items}<span className="mut"> / {e.mods}</span></td>
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
                          onInspect?.(e.id);
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
            {rows.slice(0, 12).map((e: any) => (
              <button key={e.id} className="card" style={{ padding: 15, textAlign: "left" }} onClick={() => go({ page: "eco", id: e.id })}>
                <div className="bet"><span className="pn">{e.id}</span>{stageChip(e.stage)}</div>
                <div style={{ fontWeight: 600, margin: "9px 0 4px" }}>{e.title}</div>
                <div className="sub" style={{ minHeight: 34, lineHeight: 1.5 }}>{e.desc.slice(0, 76)}…</div>
                <div className="row" style={{ marginTop: 12, gap: 8, paddingTop: 10, borderTop: `1px solid ${T.g100}` }}>
                  <Chip k={e.div === "AG" ? "teal" : "blue"}>{e.div}</Chip>
                  <span className="mini">{e.items} items</span>
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


