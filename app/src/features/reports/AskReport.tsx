import { InterpretationChips } from '@/components/lifecycle/InterpretationChips'
import { Card } from '@/components/primitives/Card'
import { Chip } from '@/components/primitives/Chip'
import { EXAMPLE_QUERIES, valFor } from '@/domain/reports'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import { Download, Pencil, Play, RefreshCw, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'

function AskReport({ onOpenBuilder, onOpenReport }: { onOpenBuilder?: (cfg: any) => void; onOpenReport?: (title: string) => void }) {
  const [q, setQ] = useState("");
  const [out, setOut] = useState(false);
  const [busy, setBusy] = useState(false);
  const cols = ["Item number", "Item name", "Supplier name", "Manufacturer part number", "Supplier site"];
  const ask = (text: any) => { setQ(text); setBusy(true); setTimeout(() => { setBusy(false); setOut(true); }, 700); };
  return (
    <div className="stack">
      <Card>
        <div className="row" style={{ alignItems: "flex-start", gap: 11 }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: T.vioBg, display: "grid", placeItems: "center", flex: "none" }}>
            <Sparkles size={16} color={T.vio} /></span>
          <textarea className="inp" rows={2} style={{ flex: 1 }} value={q} onChange={(e: any) => setQ(e.target.value)}
            placeholder="Describe the data you need. For example: for these 1,000 part numbers give me the supplier and the manufacturer part number" />
          <button className="btn pri lg" disabled={busy}
            onClick={() => ask(q || "Supplier and manufacturer part number for every part on the TS CG mounting kits")}>
            {busy ? <RefreshCw size={13} /> : <Send size={13} />}{busy ? "Building" : "Build report"}</button>
        </div>
        <div className="row" style={{ marginTop: 12, gap: 6, flexWrap: "wrap" }}>
          {EXAMPLE_QUERIES.map((x: any) => (
            <span
              key={x}
              className="chip c-gray"
              onClick={() => ask(x)}
              style={{
                borderRadius: 6,
                fontSize: 11,
                padding: "3px 9px",
                background: "#f0f4f8",
                color: "#486581",
                border: "none",
                fontWeight: 400,
                cursor: "pointer",
                textAlign: "left",
                lineHeight: "17px",
                whiteSpace: "normal"
              }}
              onMouseEnter={(e: any) => { e.currentTarget.style.background = "#e2e8f0"; e.currentTarget.style.color = "#0a2233"; }}
              onMouseLeave={(e: any) => { e.currentTarget.style.background = "#f0f4f8"; e.currentTarget.style.color = "#486581"; }}
            >
              {x}
            </span>
          ))}
        </div>
      </Card>
      {out && (
        <Card title="Draft report" sub="Check the interpretation, then export or open it in the builder" pad={false}
          right={<>
            <button className="btn sm" onClick={() => onOpenBuilder && onOpenBuilder({
              cols: ["Item number", "Item name", "Supplier name", "Manufacturer part number", "Supplier site"],
              filters: [{ f: "Category", op: "is", v: "KIT, HARDWARE, BRACKETS & PLATES" }, { f: "Parent item", op: "contains", v: "1003140" }],
              group: ["Supplier name"],
              sorts: [{ f: "Item number", dir: "Ascending" }]
            })}><Pencil size={12} />Open in builder</button>
            <button className="btn sm">Save report</button>
            <button className="btn sm pri" onClick={() => downloadFile("topcon-report.csv",
              cols.join(",") + "\n" + [0, 1, 2, 3, 4, 5].map((k: any) => cols.map((c: any) => valFor(c, k)).join(",")).join("\n"))}>
              <Download size={12} />Export</button>
          </>}>
          <InterpretationChips
            chips={[
              { id: "1", label: "Items" },
              { id: "2", label: "Supplier items", join: "joined to" },
              { id: "3", label: "Category is KIT, HARDWARE, BRACKETS & PLATES", join: "where" },
              { id: "4", label: "Parent is 1003140 family", join: "and" },
            ]}
          />
          <table className="tbl">
            <thead><tr>{cols.map((c: any) => <th key={c} style={{ borderBottom: "1px solid #d9e2ec" }}>{c}</th>)}</tr></thead>
            <tbody>{[0, 1, 2, 3, 4, 5].map((k: any) => (
              <tr key={k}>{cols.map((c: any, j: any) => <td key={c} className={j === 0 ? "pn" : ""} style={{ borderBottom: "1px solid #d9e2ec" }}>{valFor(c, k)}</td>)}</tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      <div className="grid2">
        <Card title="Recent questions" sub="Click to run query" pad={false}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {EXAMPLE_QUERIES.map((query: any, idx: any) => (
              <div
                key={query}
                onClick={() => ask(query)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "11px 14px",
                  border: "none",
                  borderBottom: "none",
                  cursor: "pointer",
                  transition: "background 0.12s"
                }}
                onMouseEnter={(e: any) => { e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={(e: any) => { e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: T.b50,
                      color: T.brand,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0
                    }}
                  >
                    <Play size={11} fill={T.brand} />
                  </span>
                  <span style={{ fontSize: 13, color: "#0a2233", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {query}
                  </span>
                </div>
                <span className="mini" style={{ color: T.g600, flexShrink: 0, fontWeight: 600 }}>Run</span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="What people ask most"
          sub="Top saved reports by team usage"
          right={<Chip k="vio" icon={Sparkles}>AI Insight</Chip>}
          pad={false}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {[
              { title: "Open changes by routing", runs: 142, schedule: "Daily 07:00", type: "Builder" },
              { title: "Items pending SAP confirmation", runs: 98, schedule: "Every 4 hours", type: "Builder" },
              { title: "Inactivations awaiting unique parts review", runs: 64, schedule: "Weekly Monday", type: "Ask" }
            ].map((r: any, idx: any) => (
              <div
                key={r.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 14px",
                  border: "none",
                  borderBottom: "none"
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <b style={{ fontSize: 13, fontWeight: 600, color: "#0a2233" }}>{r.title}</b>
                    <Chip k={r.type === "Ask" ? "vio" : "blue"}>{r.type}</Chip>
                  </div>
                  <div className="mini" style={{ marginTop: 2, color: T.g600 }}>
                    {r.runs} runs · {r.schedule}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn sm gh"
                  onClick={() => onOpenReport ? onOpenReport(r.title) : onOpenBuilder ? onOpenBuilder({
                    cols: ["Item number", "Item name", "Lifecycle phase", "Owner"],
                    filters: [],
                    sorts: []
                  }) : null}
                  style={{ color: T.brand, fontWeight: 600, padding: "0 8px", height: 26, fontSize: 11 }}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

export { AskReport }


