import { Donut } from '@/components/charts/Donut'
import { HBars } from '@/components/charts/HBars'
import { Card } from '@/components/primitives/Card'
import { Chip, stageChip } from '@/components/primitives/Chip'
import { Kpi } from '@/components/primitives/Kpi'
import type { PlmAiInsight, PlmUser } from '@/data/admin'
import { useAllChangeOrders, deriveCoKpis } from '@/data/changeOrders'
import { T } from '@/theme/tokens'
import { differenceInDays, format, parse } from 'date-fns'
import { AlertTriangle, Boxes, ChevronDown, ChevronUp, Clock, FileText, Pencil, Plus, Send, Sparkles } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/* ============================== HOME ================================ */

function greetingWord(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function HomePage({ go, renderHeaderActions, userRole = 'unknown', userName = '', aiInsights = [], currentUser = null }: { go: any; renderHeaderActions?: () => React.ReactNode; userRole?: string; userName?: string; aiInsights?: PlmAiInsight[]; currentUser?: PlmUser | null }) {
  const [expandedInsights, setExpandedInsights] = useState<Record<string, boolean>>({});
  const toggleInsight = (key: string) => setExpandedInsights((prev) => ({ ...prev, [key]: !prev[key] }));

  // Greeting — derived live from the current user record and real clock
  const now = new Date()
  const displayName = currentUser?.name ? currentUser.name.split(' ')[0] : (userName.split(' ')[0] || 'there')
  const greeting = `${greetingWord()}, ${displayName}`
  const dateStr = format(now, "EEEE, d MMMM yyyy")
  const timeStr = format(now, "h:mm a")
  const groupLabel = currentUser?.group ?? ''
  const siteLabel = currentUser?.site ?? ''
  const subLine = [dateStr, timeStr, groupLabel, siteLabel].filter(Boolean).join(' · ')
    const isApprover = userRole === 'approver'
  // Approvers start on Approval tab; DC starts on Awaiting me
  const [selectedHomeStage, setSelectedHomeStage] = useState(isApprover ? "Approval" : "Awaiting me");

  // Backend change orders — approvers see only ECOs they are listed in (approvalsJson match),
  // plus Rejected ones. Falls back to all Approval-stage when username not yet resolved.
  const { data: rawOrders, loading: ordersLoading } = useAllChangeOrders();
  const allOrders = useMemo(() => {
    if (!isApprover) return rawOrders
    if (!userName) return rawOrders.filter((o) => o.stage === 'Approval' || o.stage === 'Rejected')
    return rawOrders.filter((o) => {
      if (o.stage === 'Rejected') return true
      return o.approvals.some(
        (a) => a.approver === userName || (a.others ?? []).includes(userName)
      )
    })
  }, [isApprover, rawOrders, userName]);
  const kpis = useMemo(() => deriveCoKpis(allOrders), [allOrders]);
  const awaiting = useMemo(
    () => allOrders.filter((o) => o.awaitingMe || o.stage === 'Rejected'),
    [allOrders]
  );

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

  const homeStages = useMemo(() => isApprover
    ? [
        { key: "Approval", label: "Approval", count: kpis.approval },
        { key: "Rejected", label: "Rejected", count: kpis.rejected },
        { key: "All", label: "All", count: kpis.total },
      ]
    : [
        { key: "Awaiting me", label: "Awaiting me", count: awaiting.length },
        { key: "Open", label: "Open", count: kpis.open },
        { key: "Submit", label: "Submit", count: kpis.submit },
        { key: "Approval", label: "Approval", count: kpis.approval },
        { key: "Effective", label: "Effective", count: kpis.effective },
        { key: "Complete", label: "Complete", count: kpis.complete },
        { key: "Rejected", label: "Rejected", count: kpis.rejected },
        { key: "All", label: "All", count: kpis.total },
      ],
  [isApprover, kpis, awaiting]);

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
          <h1 data-test-id="home-greeting">{greeting}</h1>
          <div className="sub" style={{ marginTop: 4 }} data-test-id="home-greeting-sub">Your change order activity and open actions at a glance · {subLine}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => go({ page: "reports" })}><FileText size={13} />Build A Report</button>
          <button className="btn" onClick={() => go({ page: "item-new" })}><Boxes size={13} />Create Item</button>
          <button className="btn pri" onClick={() => go({ page: "eco-new" })}><Plus size={13} />New Change Order</button>
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
              icon={Pencil}
              onClick={() => go({ page: "ecos", filter: "Open" })}
              data-test-id="home-kpi-open"
            />
            <Kpi
              label="In approval"
              value={kpis.approval}
              icon={Clock}
              onClick={() => go({ page: "ecos", filter: "Approval" })}
              data-test-id="home-kpi-awaiting"
            />
            <Kpi
              label="Effective / Complete"
              value={kpis.effective + kpis.complete}
              icon={Send}
              onClick={() => go({ page: "ecos", filter: "Effective" })}
              data-test-id="home-kpi-submit"
            />
            <Kpi
              label="Rejected"
              value={kpis.rejected}
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

          {/* Section header + toolbar above the table card */}
          <div className="toolbar" data-test-id="home-change-orders-toolbar">
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

          <Card
            pad={false}
            data-test-id="home-change-orders-card"
          >
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
          <section className="card" style={{ minWidth: 0 }} data-test-id="ai-insights-card">
            {/* Header row */}
            <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${T.g200}` }} data-test-id="ai-insights-header">
              <span style={{ width: 32, height: 32, borderRadius: 8, background: T.vioBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden="true">
                <Sparkles size={15} style={{ color: T.vio }} />
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.g900, flex: 1 }}>AI insights</span>
              {aiInsights.length > 0 && (
                <span className="chip c-vio" style={{ fontWeight: 600, fontSize: 11 }} data-test-id="ai-insights-count">
                  {aiInsights.length} active
                </span>
              )}
            </div>

            {/* Insight rows */}
            <div data-test-id="ai-insights-list">
              {aiInsights.length === 0 && (
                <div style={{ padding: "28px 20px", textAlign: "center", color: T.g500, fontSize: 13 }} data-test-id="ai-insights-empty">
                  No AI insights for your account right now.
                </div>
              )}
              {aiInsights.map((insight, idx) => {
                const isExpanded = !!expandedInsights[insight.id]
                const dotColor: Record<string, string> = {
                  bad: T.bad, warn: T.warn, ok: T.ok, blue: T.brand, vio: T.vio, teal: T.teal,
                }
                const dot = dotColor[insight.tone] ?? T.g400
                const isLast = idx === aiInsights.length - 1
                return (
                  <div
                    key={insight.id}
                    style={{ borderBottom: isLast ? "none" : `1px solid ${T.g200}` }}
                    data-test-id={`ai-insight-${insight.id}`}
                  >
                    {/* Title row — always visible */}
                    <button
                      type="button"
                      onClick={() => toggleInsight(insight.id)}
                      aria-expanded={isExpanded}
                      data-test-id={`ai-insight-toggle-${insight.id}`}
                      style={{
                        width: "100%", display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "14px 18px", background: "transparent", border: "none",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      {/* Status dot */}
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: dot, flexShrink: 0, marginTop: 4 }} aria-hidden="true" />

                      {/* Title + sub */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.g900, lineHeight: 1.45 }} data-test-id={`ai-insight-lead-${insight.id}`}>
                          {insight.lead}
                        </div>
                        {insight.sub && (
                          <div style={{ marginTop: 4, fontSize: 12, color: T.g600, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }} data-test-id={`ai-insight-sub-${insight.id}`}>
                            <span style={{ color: T.brand, fontWeight: 600, cursor: "pointer" }}
                              onClick={(e) => { e.stopPropagation(); go({ page: "eco", id: insight.ecoId }) }}
                            >{insight.ecoId}</span>
                            <span style={{ color: T.g400 }}>·</span>
                            <span>{insight.sub}</span>
                          </div>
                        )}
                      </div>

                      {/* Chevron */}
                      <span style={{ color: T.g500, flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center" }}>
                        {isExpanded ? <ChevronUp size={15} strokeWidth={2} /> : <ChevronDown size={15} strokeWidth={2} />}
                      </span>
                    </button>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div style={{ padding: "0 18px 16px 40px" }} data-test-id={`ai-insight-detail-${insight.id}`}>
                        <p style={{ fontSize: 13, color: T.g700, lineHeight: 1.6, margin: "0 0 14px 0" }}>
                          {insight.detail}
                        </p>
                        <button
                          type="button"
                          className="btn pri sm"
                          onClick={() => go({ page: "eco", id: insight.ecoId })}
                          data-test-id={`ai-insight-action-${insight.id}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          Open {insight.ecoId}
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
      <style>{`@media(max-width:1100px){.homegrid{grid-template-columns:1fr !important}}`}</style>
    </div>
  );
}

export { HomePage }


