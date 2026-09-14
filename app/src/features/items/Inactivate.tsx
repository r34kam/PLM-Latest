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

  const handleRunAnalysis = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setAnalyzed(true);
      // Auto-select the parent + any unique children
      const uniquePns = rawRows.filter((r: any) => r.isParent || r.unique).map((r: any) => r.pn);
      setSel(uniquePns);
    }, 900);
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
                  go({
                    page: "eco-new",
                    step: 0,
                    initialManualItems: filteredRows.filter((r: any) => sel.includes(r.pn)).map((r: any) => r.pn)
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

        {loading && (
          <div
            data-test-id="unique-parts-analysis-loader"
            style={{
              padding: "24px 20px",
              background: "#F8FAFC",
              borderBottom: "1px solid #E2E8F0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16
            }}
          >
            <div className="row" style={{ gap: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: T.b50,
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0
                }}
              >
                <Loader2 size={18} color={T.brand} style={{ animation: "spin 1s linear infinite" }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#0A2233" }}>
                  Running unique part analysis across live where-used graph…
                </div>
                <div className="sub" style={{ marginTop: 2, fontSize: 12 }}>
                  Recursively walking {parent.bom} BOM lines of {parent.pn} across all products and active assemblies.
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <span className="chip c-blue">AI Assisted</span>
              <span className="mini" style={{ color: T.g600 }}>Step 1 of 1</span>
            </div>
          </div>
        )}

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
                        onChange={() => toggleSel(it.pn)}
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


