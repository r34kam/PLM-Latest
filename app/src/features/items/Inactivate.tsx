import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { useAllBomItems, useBomItemsByKit } from '@/data/bomItems'
import { useItemByPn } from '@/data/items'
import { BOMS, bomFor } from '@/domain/boms'
import { ITEMS } from '@/domain/catalog'
import { T } from '@/theme/tokens'
import { ArrowRight, Ban, Boxes, Check, ChevronRight, Layers, Loader2, Sparkles, X } from 'lucide-react'
import React, { useState } from 'react'

/* ==================== UNIQUE PARTS / INACTIVATION ==================== */

function Inactivate({ go, id = "01-080401-03", renderHeaderActions }: { go: any; id?: string; renderHeaderActions?: () => React.ReactNode }) {
  // Load item from backend; fall back to static ITEMS
  const itemFromBackend = useItemByPn(id);
  const parent = itemFromBackend ?? ITEMS.find((i: any) => i.pn === id) ?? ITEMS[2];

  // Load live BOM items from the backend BomItem object (same source as the BOM tab)
  const { bomItems: liveBomItems } = useBomItemsByKit(parent.pn);
  // All BOM items across every kit — for cross-kit unique-parts calculation
  const { bomItems: allKitBomItems } = useAllBomItems();

  // BOM children: prefer live BomItem records, fall back to bomLines JSON, then static BOMS
  const bomChildren = React.useMemo(() => {
    if (liveBomItems.length > 0) return liveBomItems;
    try { const parsed = JSON.parse((parent as any).bomLines || "[]"); if (parsed.length > 0) return parsed; } catch {}
    return bomFor(parent.pn);
  }, [liveBomItems, (parent as any).bomLines, parent.pn]);

  const [analyzed, setAnalyzed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanningPn, setScanningPn] = useState<string>("");
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("All");
  const [sel, setSel] = useState<string[]>([]);

  // Build rows from the real BOM children — same data as the BOM tab
  const rawRows = React.useMemo(() => [
    {
      pn: parent.pn,
      name: parent.name,
      rev: parent.rev,
      cat: parent.cat,
      phase: parent.phase,
      status: parent.status,
      isParent: true,
      unique: true,
      otherParents: "—",
      lvl: "Parent",
      plant: parent.plant || "1210 – TPS Livermore",
    },
    ...bomChildren.map((c: any) => ({
      pn: c.pn,
      name: c.name,
      rev: c.rev || "A",
      cat: c.cat || "HARDWARE",
      phase: c.phase || "In Production",
      status: "20 – ACTIVE",
      isParent: false,
      // A child is "unique" if it only appears in THIS kit's BOM across all kits.
      // If live cross-kit data is available, use it; otherwise fall back to static BOMS.
      unique: allKitBomItems.length > 0
        ? allKitBomItems.filter((ab: any) => ab.pn === c.pn && ab.kitNumber !== parent.pn).length === 0
        : !Object.entries(BOMS).some(([aPn, kids]: any) =>
            aPn !== parent.pn && (kids as any[]).some((k: any) => k.pn === c.pn)
          ),
      otherParents: allKitBomItems.length > 0
        ? allKitBomItems.filter((ab: any) => ab.pn === c.pn && ab.kitNumber !== parent.pn).length
        : Object.values(BOMS).filter((kids: any) =>
            (kids as any[]).some((k: any) => k.pn === c.pn)
          ).length - 1,
      lvl: "Level 1",
      plant: parent.plant || "1210 – TPS Livermore",
    })),
  ], [parent, bomChildren, allKitBomItems]);

  // 1 second per item in scope
  const ANALYSIS_MS = rawRows.length * 1000;

  const handleRunAnalysis = () => {
    setLoading(true);
    setScanningPn(rawRows[0]?.pn ?? "");

    const allPns = rawRows.map((r: any) => r.pn);
    const intervalMs = allPns.length > 1 ? Math.floor(ANALYSIS_MS / allPns.length) : ANALYSIS_MS;
    let idx = 0;
    const ticker = setInterval(() => {
      idx += 1;
      if (idx < allPns.length) setScanningPn(allPns[idx]);
    }, intervalMs);

    setTimeout(() => {
      clearInterval(ticker);
      setLoading(false);
      setScanningPn("");
      setAnalyzed(true);
      const selectablePns = rawRows.filter((r: any) => r.isParent || r.unique).map((r: any) => r.pn);
      setSel(selectablePns);
    }, ANALYSIS_MS);
  };

  const segs = analyzed
    ? ["All", "Unique", "Shared"]
    : ["All", "Parent", "Children"];

  const count = (s: string) => {
    if (!analyzed) {
      if (s === "All") return rawRows.length;
      if (s === "Parent") return 1;
      if (s === "Children") return rawRows.length - 1;
      return rawRows.length;
    }
    if (s === "All") return rawRows.length;
    if (s === "Unique") return rawRows.filter((r: any) => r.unique).length;
    if (s === "Shared") return rawRows.filter((r: any) => !r.isParent && !r.unique).length;
    return rawRows.length;
  };

  const filteredRows = rawRows.filter((r: any) => {
    const matchQ = (r.pn + " " + r.name + " " + r.cat).toLowerCase().includes(q.toLowerCase());
    if (!matchQ) return false;
    if (!analyzed) {
      if (seg === "Parent") return r.isParent;
      if (seg === "Children") return !r.isParent;
      return true;
    }
    if (seg === "Unique") return r.unique;
    if (seg === "Shared") return !r.isParent && !r.unique;
    return true;
  });

  const toggleSel = (pn: string) =>
    setSel(sel.includes(pn) ? sel.filter((x: any) => x !== pn) : [...sel, pn]);

  return (
    <div className="stack" data-test-id="inactivate-page">
      <div>
        <div className="crumb">
          <a onClick={() => go({ page: "items" })}>Items</a>
          <ChevronRight size={11} />
          <a onClick={() => go({ page: "item", id: parent.pn })}>{parent.pn}</a>
          <ChevronRight size={11} />
          Inactivate
        </div>
        <div className="bet">
          <div className="row" style={{ gap: 11 }}>
            <h1>Inactivate {parent.pn}</h1>
            {phaseChip(parent.phase)}
            <span className="sub">{parent.name} rev {parent.rev}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn gh"
              type="button"
              data-test-id="inactivate-cancel-btn"
              onClick={() => go({ page: "items" })}
            >
              <X size={14} strokeWidth={2} />Cancel
            </button>
            <button
              className="btn pri"
              type="button"
              data-test-id="run-unique-parts-analysis-btn"
              disabled={loading}
              onClick={handleRunAnalysis}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "0 16px",
                height: 34,
                boxShadow: "0 2px 6px rgba(10, 79, 143, 0.28)"
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                  <span>Analyzing BOM hierarchy…</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>{analyzed ? "Re-run analysis" : "Run unique part analysis"}</span>
                </>
              )}
            </button>
            {analyzed && (
              <button
                className="btn pri"
                type="button"
                data-test-id="inactivate-create-eco-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  height: 34,
                  background: "#0B7A4B",
                  borderColor: "#0B7A4B"
                }}
                onClick={() => {
                  const selectedItems = rawRows
                    .filter((r: any) => sel.includes(r.pn))
                    .map((r: any) => ({ pn: r.pn, name: r.name }));
                  go({
                    page: "eco-new",
                    step: 5,  // maps to Approvals step (index 2)
                    initialManualItems: selectedItems,
                    initialTitle: `Inactivate ${parent.pn} \u2013 ${parent.name}`,
                    initialDesc: `Inactivation ECO for ${parent.pn} (${parent.name} rev ${parent.rev}).\n\nUnique parts identified by analysis:\n${selectedItems.filter((x: any) => x.pn !== parent.pn).map((x: any) => `\u2022 ${x.pn} \u2013 ${x.name}`).join('\n')}\n\nAll items above are unique to this assembly and safe to inactivate.`,
                    initialCat: "ECO: Engineering Change Order",
                  });
                }}
              >
                <ArrowRight size={14} />
                <span>Create Inactivation ECO ({sel.length})</span>
              </button>
            )}
            {renderHeaderActions?.()}
          </div>
        </div>
      </div>

      <Card pad={false}>
        <div className="ch" style={{ padding: "16px 20px" }}>
          <div>
            <h2>Items in scope</h2>
            <div className="sub" style={{ marginTop: 2 }}>
              {rawRows.length} items evaluated for inactivation under {parent.pn}
            </div>
          </div>
        </div>

        <Toolbar
          q={q}
          setQ={setQ}
          placeholder="Filter by part number, name or category"
          segs={segs}
          seg={seg}
          setSeg={setSeg}
          count={count}
          selected={sel.length}
          onClearSel={() => setSel([])}
          bulk={
            analyzed ? (
              <span className="sub" style={{ fontSize: 12 }}>
                {sel.length} item{sel.length === 1 ? "" : "s"} selected
              </span>
            ) : null
          }
          right={
            <div className="row" style={{ gap: 8 }}>
              {analyzed && (
                <span className="mini" style={{ color: "#486581" }}>
                  Unique parts pre-selected for inactivation
                </span>
              )}
            </div>
          }
        />

        {loading && (() => {
          const scanIdx = rawRows.findIndex((r: any) => r.pn === scanningPn);
          const pct = Math.round(((scanIdx + 1) / Math.max(rawRows.length, 1)) * 100);
          const stepMs = Math.floor(ANALYSIS_MS / Math.max(rawRows.length, 1));
          return (
            <div
              data-test-id="unique-parts-analysis-loader"
              style={{
                padding: "18px 24px 20px",
                background: "linear-gradient(135deg, #EEF4FF 0%, #F0FDF4 100%)",
                borderBottom: "1px solid #E2E8F0",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Subtle shimmer stripe */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)",
                animation: "shimmer 1.8s ease-in-out infinite",
              }} />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 14, position: "relative" }}>
                <div className="row" style={{ gap: 14 }}>
                  {/* Pulse ring icon */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12,
                      background: "linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)",
                      display: "grid", placeItems: "center",
                      boxShadow: "0 4px 12px rgba(99,102,241,0.35)",
                    }}>
                      <Sparkles size={18} color="#ffffff" />
                    </div>
                    <div style={{
                      position: "absolute", inset: -3, borderRadius: 15,
                      border: "2px solid rgba(99,102,241,0.3)",
                      animation: "pulse 1.4s ease-in-out infinite",
                    }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#1E293B", letterSpacing: "-0.01em" }}>
                      Scanning where-used graph across all assemblies…
                    </div>
                    <div style={{ marginTop: 3, fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 6 }}>
                      <span>Checking</span>
                      <span
                        key={scanningPn}
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          fontSize: 11,
                          color: "#4F46E5",
                          background: "rgba(99,102,241,0.08)",
                          padding: "1px 6px",
                          borderRadius: 4,
                          display: "inline-block",
                          animation: "fadeSlideUp .18s ease-out",
                          minWidth: 110,
                        }}
                      >
                        {scanningPn}
                      </span>
                      <span style={{ color: "#94A3B8" }}>across {rawRows.length} item{rawRows.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "#4F46E5", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
                    {pct}%
                  </span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>
                    {scanIdx + 1} of {rawRows.length} items
                  </span>
                </div>
              </div>

              {/* Progress track — segmented per item */}
              <div style={{ position: "relative" }}>
                <div style={{ height: 6, borderRadius: 6, background: "rgba(99,102,241,0.12)", overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 6,
                      background: "linear-gradient(90deg, #6366F1 0%, #3B82F6 60%, #10B981 100%)",
                      width: `${pct}%`,
                      transition: `width ${stepMs}ms linear`,
                      boxShadow: "0 0 8px rgba(99,102,241,0.5)",
                    }}
                  />
                </div>
                {/* Item tick marks */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, display: "flex" }}>
                  {rawRows.map((_: any, i: number) => (
                    i > 0 && (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          left: `${(i / rawRows.length) * 100}%`,
                          top: 0, bottom: 0,
                          width: 1,
                          background: "rgba(255,255,255,0.5)",
                        }}
                      />
                    )
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>
                  AI-assisted unique-part detection · {rawRows.length}s estimated
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase",
                  color: "#6366F1", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: 20,
                }}>
                  Live Analysis
                </span>
              </div>
            </div>
          );
        })()}

        <div className="scrollx">
          <table className="tbl inactivate-tbl" data-test-id="inactivate-items-table">
            <thead>
              <tr>
                <th style={{ width: 34, padding: "14px 20px" }}>
                  <input
                    type="checkbox"
                    checked={sel.length > 0 && sel.length === filteredRows.length}
                    onChange={() =>
                      setSel(sel.length === filteredRows.length ? [] : filteredRows.map((r: any) => r.pn))
                    }
                  />
                </th>
                <th style={{ padding: "14px 20px" }}>Item number</th>
                <th style={{ padding: "14px 20px" }}>Rev</th>
                <th style={{ padding: "14px 20px" }}>Item name</th>
                <th style={{ padding: "14px 20px" }}>Category</th>
                <th style={{ padding: "14px 20px" }}>Lifecycle phase</th>
                <th style={{ padding: "14px 20px" }}>Hierarchy</th>
                <th style={{ padding: "14px 20px" }}>Plant</th>
                {analyzed && <th style={{ minWidth: 200, padding: "14px 20px" }}>Unique part analysis</th>}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((it: any) => {
                const isSelected = sel.includes(it.pn);
                return (
                  <tr
                    key={it.pn}
                    data-test-id={`inactivate-row-${it.pn}`}
                    className={isSelected ? "sel" : ""}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={analyzed && !it.isParent && !it.unique}
                        onChange={() => toggleSel(it.pn)}
                        title={analyzed && !it.isParent && !it.unique ? `Cannot inactivate — shared across ${it.otherParents} other BOM(s)` : undefined}
                        data-test-id={`inactivate-checkbox-${it.pn}`}
                      />
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <a
                        className="pn"
                        onClick={() => go({ page: "item", id: it.pn })}
                      >
                        {it.pn}
                      </a>
                    </td>
                    <td>{it.rev}</td>
                    <td
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 280,
                        fontWeight: 600
                      }}
                      title={it.name}
                    >
                      {it.name}
                      {it.isParent && (
                        <Chip k="blue" style={{ marginLeft: 8 }}>Parent</Chip>
                      )}
                    </td>
                    <td className="sub">{it.cat}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{phaseChip(it.phase)}</td>
                    <td className="sub">{it.lvl}</td>
                    <td className="sub">{it.plant}</td>
                    {analyzed && (
                      <td data-test-id={`unique-result-${it.pn}`}>
                        {it.isParent ? (
                          <Chip k="blue" icon={Boxes}>Target parent</Chip>
                        ) : it.unique ? (
                          <Chip k="bad" icon={Ban}>Unique part (inactivate)</Chip>
                        ) : (
                          <Chip k="ok" icon={Check}>Shared ({it.otherParents} BOMs)</Chip>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={analyzed ? 9 : 8}>
                    <Empty
                      icon={Layers}
                      title="No items match your filter"
                      body="Try clearing your search query or selecting a different segment."
                      action={
                        <button className="btn sm" onClick={() => { setQ(""); setSeg("All"); }}>
                          Reset filters
                        </button>
                      }
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export { Inactivate }


