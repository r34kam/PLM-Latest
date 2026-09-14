import { Donut } from '@/components/charts/Donut'
import { HBars } from '@/components/charts/HBars'
import { Card } from '@/components/primitives/Card'
import { Chip, stageChip } from '@/components/primitives/Chip'
import { Kpi } from '@/components/primitives/Kpi'
import { useAllChangeOrders, deriveCoKpis } from '@/data/changeOrders'
import { T } from '@/theme/tokens'
import { differenceInDays, parse } from 'date-fns'
import { AlertTriangle, ArrowRight, Boxes, ChevronDown, ChevronUp, Clock, FileText, Pencil, Plus, Send, Sparkles } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/* ============================== HOME ================================ */

function HomePage({ go, renderHeaderActions }: { go: any; renderHeaderActions?: () => React.ReactNode }) {
  const [showNeedsNextOthers, setShowNeedsNextOthers] = useState(false);
  const [showFourChanges, setShowFourChanges] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});
  const toggleInsight = (key: string) => setExpandedInsights((prev: any) => ({ ...prev, [key]: !prev[key] }));
  const [selectedHomeStage, setSelectedHomeStage] = useState("Awaiting me");

  // Backend change orders
  const { data: allOrders, loading: ordersLoading } = useAllChangeOrders();
  const kpis = useMemo(() => deriveCoKpis(allOrders), [allOrders]);
  const awaiting = useMemo(() => allOrders.filter((o) => o.awaitingMe), [allOrders]);

  const byCat = useMemo(() => [
    { k: "ECO", v: kpis.byType['ECO'] ?? 0, c: "var(--chart-1)" },
    { k: "DCO", v: kpis.byType['DCO'] ?? 0, c: "var(--chart-2)" },
    { k: "TPCO", v: kpis.byType['TPCO'] ?? 0, c: "var(--chart-3)" },
    { k: "RFD", v: kpis.byType['RFD'] ?? 0, c: "var(--chart-4)" },
  ], [kpis.byType]);

  // Compute aging from open change orders using their 'created' date
  const aging = useMemo(() => {
    const now = new Date();
    const openOrders = allOrders.filter((o) => o.stage !== 'Complete' && o.stage !== 'Effective');
    let a07 = 0, a830 = 0, a3190 = 0, a90 = 0;
    openOrders.forEach((o) => {
      if (!o.created || o.created === '—') return;
      try {
        const d = parse(o.created, 'MM/dd/yyyy', now);
        const age = differenceInDays(now, d);
        if (age <= 7) a07++;
        else if (age <= 30) a830++;
        else if (age <= 90) a3190++;
        else a90++;
      } catch { /* skip unparseable dates */ }
    });
    return [
      { k: '0–7 days', v: a07, c: T.teal },
      { k: '8–30 days', v: a830, c: T.b400 },
      { k: '31–90 days', v: a3190, c: T.warn },
      { k: 'Over 90 days', v: a90, c: T.bad },
    ];
  }, [allOrders]);

  const homeStages = useMemo(() => [
    { key: "Awaiting me", label: "Awaiting me", count: kpis.awaitingMe },
    { key: "Open", label: "Open", count: kpis.open },
    { key: "Submit", label: "Submit", count: kpis.submit },
    { key: "Approval", label: "Approval", count: kpis.approval },
    { key: "Effective", label: "Effective", count: kpis.effective },
    { key: "Complete", label: "Complete", count: kpis.complete },
    { key: "Rejected", label: "Rejected", count: kpis.rejected },
    { key: "All", label: "All", count: kpis.total },
  ], [kpis]);

  const currentFilteredList = useMemo(() => {
    if (selectedHomeStage === "Awaiting me") return awaiting;
    if (selectedHomeStage === "All") return allOrders;
    return allOrders.filter((o) => o.stage === selectedHomeStage);
  }, [selectedHomeStage, awaiting, allOrders]);

  const activeStageObj = homeStages.find((s) => s.key === selectedHomeStage) ?? homeStages[0];

  return (
    <div className="stack" data-test-id="home-page">
      <div className="bet">
        <div>
          <h1>Good morning, Hannerose</h1>
          <div className="sub" style={{ marginTop: 4 }}>Friday, 11 September 2026 · Document Control · TPS Livermore</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => go({ page: "reports" })}><FileText size={13} />Build a report</button>
          <button className="btn" onClick={() => go({ page: "item-new" })}><Boxes size={13} />Create item</button>
          <button className="btn pri" onClick={() => go({ page: "eco-new" })}><Plus size={13} />New change order</button>
          {renderHeaderActions?.()}
        </div>
      </div>

      <div className="grid4" data-test-id="home-kpis">
        {ordersLoading ? (
          <>
            <Skeleton className="h-20 rounded-lg" data-test-id="home-kpi-skeleton-1" />
            <Skeleton className="h-20 rounded-lg" data-test-id="home-kpi-skeleton-2" />
            <Skeleton className="h-20 rounded-lg" data-test-id="home-kpi-skeleton-3" />
            <Skeleton className="h-20 rounded-lg" data-test-id="home-kpi-skeleton-4" />
          </>
        ) : (
          <>
            <Kpi
              label="Open / Submit"
              value={kpis.open + kpis.submit}
              note="Being worked"
              icon={Pencil}
              onClick={() => go({ page: "ecos", filter: "Open" })}
              data-test-id="home-kpi-open"
            />
            <Kpi
              label="In approval"
              value={kpis.approval}
              note={`${kpis.awaitingMe} awaiting me`}
              icon={Clock}
              onClick={() => go({ page: "ecos", filter: "Approval" })}
              data-test-id="home-kpi-awaiting"
            />
            <Kpi
              label="Effective / Complete"
              value={kpis.effective + kpis.complete}
              note="Synced to SAP"
              icon={Send}
              onClick={() => go({ page: "ecos", filter: "Effective" })}
              data-test-id="home-kpi-submit"
            />
            <Kpi
              label="Rejected"
              value={kpis.rejected}
              note="Held by document control"
              icon={AlertTriangle}
              onClick={() => go({ page: "ecos", filter: "Rejected" })}
              data-test-id="home-kpi-rejected"
            />
          </>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr minmax(0,340px)", gap: 16, alignItems: "start" }} className="homegrid">
        {/* Left column: charts / infographics / tables */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <Card title="By category" data-test-id="home-chart-by-category">
              {ordersLoading ? <Skeleton className="h-40" data-test-id="home-chart-category-skeleton" /> : <Donut data={byCat} />}
            </Card>

            <Card title="Aging of open changes" style={{ minWidth: 0 }} data-test-id="home-chart-aging">
              <HBars data={aging} />
            </Card>
          </div>

          <Card
            title="Change orders"
            pad={false}
            data-test-id="home-change-orders-card"
            right={
              <button
                className="btn sm gh"
                onClick={() => go({ page: "ecos", filter: activeStageObj.key === "Awaiting me" ? "Approval" : activeStageObj.key })}
                data-test-id="home-view-in-changes-btn"
              >
                View in Changes ({activeStageObj.count}) <ArrowRight size={12} />
              </button>
            }
          >
            {/* Smart filter pills */}
            <div style={{ padding: "12px 20px 8px" }}>
              <div className="seg" data-test-id="home-stage-filter-pills">
                {homeStages.map((st) => {
                  const active = selectedHomeStage === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      className={active ? "on" : ""}
                      onClick={() => setSelectedHomeStage(st.key)}
                      data-test-id={`home-stage-pill-${st.key.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      <span>{st.label}</span>
                      <span className="n">{st.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {ordersLoading ? (
              <div style={{ padding: "12px 20px" }} data-test-id="home-orders-table-skeleton">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 mb-2" />)}
              </div>
            ) : (
              <table className="tbl" data-test-id="home-orders-table">
                <thead>
                  <tr>
                    <th>Change</th>
                    <th>Type</th>
                    <th>Routing</th>
                    <th>Stage</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {currentFilteredList.map((e) => (
                    <tr key={e.id} data-test-id={`home-order-row-${e.id}`}>
                      <td>
                        <a className="pn" onClick={() => go({ page: "eco", id: e.coId })}>{e.coId}</a>
                        <div className="sub">{e.title}</div>
                      </td>
                      <td><span className="sub">{e.type}</span></td>
                      <td>{e.routing}</td>
                      <td>{stageChip(e.stage)}</td>
                      <td className="sub">{e.submitted}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn sm"
                          onClick={() => go({ page: "eco", id: e.coId, tab: "Approvals" })}
                          data-test-id={`home-order-review-btn-${e.id}`}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                  {currentFilteredList.length === 0 && (
                    <tr data-test-id="home-orders-empty">
                      <td colSpan={6} style={{ textAlign: "center", color: "#7993a8", padding: "20px 12px" }}>
                        No changes in this stage.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Right column: AI Insight panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Card
            title="AI Insights"
            right={<Chip k="vio" icon={Sparkles}>6 Active</Chip>}
            style={{ minWidth: 0 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Insight 1: DCO-008335 */}
              <div
                style={{
                  background: "linear-gradient(to right, rgba(5, 90, 175, 0.05), rgba(5, 90, 175, 0.015)), #ffffff",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 1px 2px rgba(2,42,66,.04), 0 8px 20px -12px rgba(2,42,66,.18)",
                  padding: "11px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
                data-test-id="home-needs-you-next-ai-insight"
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.45, flex: 1, minWidth: 0 }} data-test-id="home-needs-you-next-ai-insight-lead">
                    <b>DCO-008335 is the one change to clear first</b> — it is rejected, blocks 1 item, and the evidence it needs is an inspection report document control can attach without an engineer.
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleInsight("dco008335")}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: T.g500,
                      borderRadius: 4,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      marginTop: 1,
                    }}
                    title={expandedInsights["dco008335"] ? "Collapse details" : "Expand details"}
                    aria-label="Toggle details"
                  >
                    {expandedInsights["dco008335"] ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
                  </button>
                </div>

                {expandedInsights["dco008335"] && (
                  <div style={{ fontSize: 11, color: T.g700, lineHeight: 1.45, background: "rgba(0,95,168,0.04)", borderRadius: 6, padding: "5px 8px" }}>
                    Inspection report Form QC-802 is on file in TPS Livermore DMS. Uploading this attachment resolves QA rejection criterion #2 and unblocks part 1006394-01 for manufacturing release.
                  </div>
                )}

                <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }} data-test-id="home-needs-you-next-ai-insight-sub">
                  Ranked across 22 open changes by what is blocking a stage move — 4 past due
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                  <button
                    className="btn pri sm"
                    onClick={() => go({ page: "eco", id: "DCO-008335" })}
                    data-test-id="needs-you-next-primary-action-btn"
                  >
                    Open rework
                  </button>

                  <button
                    type="button"
                    className="btn gh sm"
                    onClick={() => setShowNeedsNextOthers(!showNeedsNextOthers)}
                    style={{ padding: "0 6px", height: 26, color: T.g700 }}
                    data-test-id="toggle-other-four-btn"
                  >
                    <span>Show the other 4</span>
                    {showNeedsNextOthers ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
                  </button>
                </div>

                {showNeedsNextOthers && (
                  <div
                    style={{
                      marginTop: 4,
                      paddingTop: 6,
                      border: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      minWidth: 0,
                    }}
                    data-test-id="home-needs-next-other-four-list"
                  >
                    {[
                      {
                        id: "ECO-011416",
                        reason: "Finished SAP sync 14 minutes ago — all 3 items confirmed in SAP ECC plant 1210. Move to Complete to close.",
                        action: "Verify & complete",
                        go: { page: "eco", id: "ECO-011416" },
                      },
                      {
                        id: "ECO-011420",
                        reason: "Needs Stage 2 document control sign-off — Stage 1 of 2: 3 of 9 approvals still open (Steve Howe, Grace Mutiso, Carol Nosworthy).",
                        action: "Review",
                        go: { page: "eco", id: "ECO-011420" },
                      },
                      {
                        id: "ECO-010870",
                        reason: "Unique-parts analysis finished — 129 requested parts expanded to 265 modifications, 9 unique children found under 01-080401-03.",
                        action: "Review cascade",
                        go: { page: "inactivate" },
                      },
                      {
                        id: "AgKits_Status50.xlsx",
                        reason: "Import file waiting — 112 rows staged by Mamatha Gopal, 2 errors and 3 warnings to clear before bulk add.",
                        action: "Open import",
                        go: { page: "eco-new", step: 1 },
                      },
                    ].map((item: any) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 13,
                          padding: "4px 0",
                          minWidth: 0,
                        }}
                        data-test-id={`needs-next-row-${item.id}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, overflow: "hidden" }}>
                          <a
                            className="pn"
                            onClick={() => go(item.go)}
                            style={{ cursor: "pointer", flex: "none" }}
                          >
                            {item.id}
                          </a>
                          <span
                            className="sub"
                            style={{
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                              flex: 1,
                            }}
                            title={item.reason}
                          >
                            {item.reason}
                          </span>
                        </div>
                        <a
                          onClick={() => go(item.go)}
                          style={{ fontSize: 11, color: T.brand, textDecoration: "none", cursor: "pointer", flex: "none", fontWeight: 600 }}
                        >
                          {item.action}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Insight 2: Aging 4 changes */}
              <div
                style={{
                  background: "linear-gradient(to right, rgba(5, 90, 175, 0.05), rgba(5, 90, 175, 0.015)), #ffffff",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 1px 2px rgba(2,42,66,.04), 0 8px 20px -12px rgba(2,42,66,.18)",
                  padding: "11px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
                data-test-id="home-aging-ai-insight"
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.45, fontWeight: 600, flex: 1, minWidth: 0 }} data-test-id="home-aging-ai-insight-finding">
                    4 changes have been open more than 90 days. All four are inactivation requests waiting on unique-parts analysis.
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleInsight("aging90")}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: T.g500,
                      borderRadius: 4,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      marginTop: 1,
                    }}
                    title={expandedInsights["aging90"] ? "Collapse details" : "Expand details"}
                    aria-label="Toggle details"
                  >
                    {expandedInsights["aging90"] ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
                  </button>
                </div>

                {expandedInsights["aging90"] && (
                  <div style={{ fontSize: 11, color: T.g700, lineHeight: 1.45, background: "rgba(0,95,168,0.04)", borderRadius: 6, padding: "5px 8px" }}>
                    Inactivation requests without unique-parts review risk stranding custom components in field inventory across European and US distribution hubs. Automated cascade check identifies common subassemblies in seconds.
                  </div>
                )}

                <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }} data-test-id="home-aging-ai-insight-sub">
                  Oldest: ECO-010870, open 17 days
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 2 }}>
                  <button
                    className="btn pri sm"
                    onClick={() => go({ page: "inactivate", id: "01-080401-03" })}
                    style={{ maxWidth: "100%" }}
                    data-test-id="run-unique-parts-analysis-btn"
                  >
                    Run unique-parts analysis on all four
                  </button>

                  <button
                    type="button"
                    className="btn gh sm"
                    onClick={() => setShowFourChanges(!showFourChanges)}
                    style={{ padding: "0 6px", height: 26, color: T.g700 }}
                    data-test-id="toggle-four-changes-btn"
                  >
                    <span>Show the four changes</span>
                    {showFourChanges ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
                  </button>
                </div>

                {showFourChanges && (
                  <div
                    style={{
                      marginTop: 4,
                      paddingTop: 6,
                      border: "none",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      minWidth: 0,
                    }}
                    data-test-id="home-aging-four-changes-list"
                  >
                    {[
                      { id: "ECO-010870", title: "Move to Status 50 - Ag Kits", days: 17 },
                      { id: "ECO-011288", title: "Inactivate FC-5000/SHC5000 BATTERY 1029732-01", days: 78 },
                      { id: "ECO-011244", title: "Inactivate SGR-1 Receiver Harnesses", days: 94 },
                      { id: "ECO-011210", title: "Inactivate Legacy Topcon GPS Antennas", days: 104 },
                    ].map((item: any) => (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          fontSize: 13,
                          padding: "4px 0",
                          minWidth: 0,
                        }}
                        data-test-id={`aging-four-row-${item.id}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, overflow: "hidden" }}>
                          <a
                            className="pn"
                            onClick={() => go({ page: "eco", id: item.id })}
                            style={{ cursor: "pointer", flex: "none" }}
                          >
                            {item.id}
                          </a>
                          <span
                            className="sub"
                            style={{
                              textOverflow: "ellipsis",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              minWidth: 0,
                              flex: 1,
                            }}
                            title={item.title}
                          >
                            {item.title}
                          </span>
                        </div>
                        <span className="mini" style={{ color: T.g600, flex: "none" }}>
                          {item.days} days open
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Insight 3: ECO-011416 SAP Sync Complete */}
              <div
                style={{
                  background: "linear-gradient(to right, rgba(5, 90, 175, 0.05), rgba(5, 90, 175, 0.015)), #ffffff",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 1px 2px rgba(2,42,66,.04), 0 8px 20px -12px rgba(2,42,66,.18)",
                  padding: "11px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                    <b>ECO-011416 reached Effective stage</b> — all 3 items successfully synced to SAP ECC plant 1210.
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleInsight("sapSync")}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: T.g500,
                      borderRadius: 4,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      marginTop: 1,
                    }}
                    title={expandedInsights["sapSync"] ? "Collapse details" : "Expand details"}
                    aria-label="Toggle details"
                  >
                    {expandedInsights["sapSync"] ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
                  </button>
                </div>

                {expandedInsights["sapSync"] && (
                  <div style={{ fontSize: 11, color: T.g700, lineHeight: 1.45, background: "rgba(0,95,168,0.04)", borderRadius: 6, padding: "5px 8px" }}>
                    SAP material masters confirmed for 1003140-01, 1006394-01, and 2505-0103. Document Control sign-off will complete the change order and release revisions to shop floor.
                  </div>
                )}

                <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }}>
                  Ready to move to Complete · Synced 14m ago
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <button
                    className="btn pri sm"
                    onClick={() => go({ page: "eco", id: "ECO-011416" })}
                  >
                    Verify & complete
                  </button>
                </div>
              </div>

              {/* Insight 4: ECO-011420 Approval Bottleneck */}
              <div
                style={{
                  background: "linear-gradient(to right, rgba(5, 90, 175, 0.05), rgba(5, 90, 175, 0.015)), #ffffff",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 1px 2px rgba(2,42,66,.04), 0 8px 20px -12px rgba(2,42,66,.18)",
                  padding: "11px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                    <b>ECO-011420 bottlenecked in Stage 1</b> — 3 of 9 required approvals open for 5+ days.
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleInsight("approvalBottleneck")}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: T.g500,
                      borderRadius: 4,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      marginTop: 1,
                    }}
                    title={expandedInsights["approvalBottleneck"] ? "Collapse details" : "Expand details"}
                    aria-label="Toggle details"
                  >
                    {expandedInsights["approvalBottleneck"] ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
                  </button>
                </div>

                {expandedInsights["approvalBottleneck"] && (
                  <div style={{ fontSize: 11, color: T.g700, lineHeight: 1.45, background: "rgba(0,95,168,0.04)", borderRadius: 6, padding: "5px 8px" }}>
                    Steve Howe (Hardware), Grace Mutiso (Compliance), and Carol Nosworthy (Supply Chain) have not yet reviewed. All 14 BOM line redlines passed automated validation with 0 clashes.
                  </div>
                )}

                <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }}>
                  Stage 1 of 2 · Waiting on Hardware, Compliance, and Supply Chain
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <button
                    className="btn sm"
                    onClick={() => go({ page: "eco", id: "ECO-011420", tab: "Approvals" })}
                  >
                    Review approvals
                  </button>
                </div>
              </div>

              {/* Insight 5: Missing Compliance Certificates */}
              <div
                style={{
                  background: "linear-gradient(to right, rgba(5, 90, 175, 0.05), rgba(5, 90, 175, 0.015)), #ffffff",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 1px 2px rgba(2,42,66,.04), 0 8px 20px -12px rgba(2,42,66,.18)",
                  padding: "11px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                    <b>Missing RoHS/REACH certificates</b> — 2 changes in Submit stage require compliance declarations.
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleInsight("complianceGap")}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: T.g500,
                      borderRadius: 4,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      marginTop: 1,
                    }}
                    title={expandedInsights["complianceGap"] ? "Collapse details" : "Expand details"}
                    aria-label="Toggle details"
                  >
                    {expandedInsights["complianceGap"] ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
                  </button>
                </div>

                {expandedInsights["complianceGap"] && (
                  <div style={{ fontSize: 11, color: T.g700, lineHeight: 1.45, background: "rgba(0,95,168,0.04)", borderRadius: 6, padding: "5px 8px" }}>
                    DCO-008340 and ECO-011390 introduce overseas hardware brackets. Attaching vendor compliance declarations before routing prevents Stage 1 Quality sign-off rejection.
                  </div>
                )}

                <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }}>
                  DCO-008340 and ECO-011390 pending Quality sign-off
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <button
                    className="btn sm"
                    onClick={() => go({ page: "ecos", filter: "Submit" })}
                  >
                    View submissions
                  </button>
                </div>
              </div>

              {/* Insight 6: Inactivation Cascade on 01-080401-03 */}
              <div
                style={{
                  background: "linear-gradient(to right, rgba(5, 90, 175, 0.05), rgba(5, 90, 175, 0.015)), #ffffff",
                  borderRadius: 8,
                  border: "none",
                  boxShadow: "0 1px 2px rgba(2,42,66,.04), 0 8px 20px -12px rgba(2,42,66,.18)",
                  padding: "11px 13px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minWidth: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontSize: 13, color: T.g900, lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                    <b>Inactivation cascade on 01-080401-03</b> — proposed phase-out affects 9 active assemblies.
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleInsight("cascadeImpact")}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: "2px",
                      cursor: "pointer",
                      color: T.g500,
                      borderRadius: 4,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      marginTop: 1,
                    }}
                    title={expandedInsights["cascadeImpact"] ? "Collapse details" : "Expand details"}
                    aria-label="Toggle details"
                  >
                    {expandedInsights["cascadeImpact"] ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
                  </button>
                </div>

                {expandedInsights["cascadeImpact"] && (
                  <div style={{ fontSize: 11, color: T.g700, lineHeight: 1.45, background: "rgba(0,95,168,0.04)", borderRadius: 6, padding: "5px 8px" }}>
                    Proposed inactivation cascades into TS-i4 receiver mounts and standard cable brackets. 3 assemblies currently have active production orders in Livermore.
                  </div>
                )}

                <div style={{ fontSize: 11, color: T.g600, lineHeight: 1.4 }}>
                  9 affected parent assemblies · High production risk
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
                  <button
                    className="btn sm"
                    onClick={() => go({ page: "inactivate", id: "01-080401-03" })}
                  >
                    Review cascade
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
      <style>{`@media(max-width:1100px){.homegrid{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}

export { HomePage }


