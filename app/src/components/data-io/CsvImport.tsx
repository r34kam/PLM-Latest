import { Chip } from '@/components/primitives/Chip'
import { Kpi } from '@/components/primitives/Kpi'
import { CHECKS } from '@/domain/ecos'
import { ME } from '@/domain/session'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import { AlertTriangle, Ban, Check, CheckCircle2, Download, FileSpreadsheet, Send, Trash2, X } from 'lucide-react'
import { useState } from 'react'

/* CSV-only import with template — used for users and any simple row import */
function CsvImport({ template, templateName, columns, rows, entity = "rows", verb = "Import", onDone }: any) {
  const [file, setFile] = useState<any>(null);
  const [skip, setSkip] = useState<any[]>([]);
  const [done, setDone] = useState(0);
  const ok = rows.filter((r: any) => r.sev === "ok");
  const warn = rows.filter((r: any) => r.sev === "warn");
  const err = rows.filter((r: any) => r.sev === "err");
  const keep = [...ok, ...warn.filter((r: any) => !skip.includes(r.a))];

  if (done) return (
    <div className="okbox"><CheckCircle2 size={15} />
      <div><b>{done} {entity} processed.</b> {err.length} rows were left out because they could not be fixed automatically.
        <div style={{ marginTop: 8 }}><button className="btn sm" onClick={() => onDone && onDone(done)}>Done</button></div></div></div>
  );

  if (!file) return (
    <div className="stack">
      <button className="drop" onClick={() => setFile("topcon-users-sept.csv")}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: T.b50, display: "grid", placeItems: "center", margin: "0 auto" }}>
          <FileSpreadsheet size={20} color={T.brand} />
        </span>
        <div style={{ fontWeight: 600, marginTop: 11 }}>Choose a CSV file</div>
        <div className="sub" style={{ marginTop: 4 }}>CSV only · one row per person · up to 500 rows</div>
      </button>
      <div className="bet">
        <span className="sub">Use the template so the columns line up.</span>
        <button className="btn pri" onClick={() => downloadFile(templateName, template)}><Download size={13} />Download CSV template</button>
      </div>
      <div className="modalinnercard">
        <div style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#486581", marginBottom: 8 }}>Required columns</div>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {columns.map((c: any) => <span key={c} className="chip c-blue">{c}</span>)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div className="bet">
        <div className="row">
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.okBg, display: "grid", placeItems: "center" }}>
            <FileSpreadsheet size={16} color={T.ok} /></span>
          <div><b>{file}</b><div className="mini">{rows.length} rows read · {ME.name}</div></div>
        </div>
        <button className="btn gh sm" onClick={() => { setFile(null); setSkip([]); }}><Trash2 size={12} />Remove file</button>
      </div>
      <div className="grid3">
        <Kpi label="Ready" value={ok.length} icon={Check} />
        <Kpi label="Needs a decision" value={warn.length} icon={AlertTriangle} />
        <Kpi label="Blocked" value={err.length} icon={X} />
      </div>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th style={{ width: 34 }}>Add</th>{columns.map((c: any) => <th key={c}>{c}</th>)}<th>Check</th><th>Detail</th></tr></thead>
          <tbody>
            {[...warn, ...ok, ...err].map((r: any) => {
              const blocked = r.sev === "err";
              const on = !blocked && !skip.includes(r.a);
              return (
                <tr key={r.a} style={blocked ? { opacity: .62 } : undefined}>
                  <td>{blocked ? <Ban size={13} color={T.g400} />
                    : <input type="checkbox" checked={on} onChange={() => setSkip(on ? [...skip, r.a] : skip.filter((x: any) => x !== r.a))} />}</td>
                  <td className="pn">{r.a}</td><td>{r.b}</td><td className="sub">{r.c}</td>
                  <td className="sub">{r.d}</td><td>{r.e}</td><td>{r.f}</td>
                  <td><Chip k={CHECKS[r.sev].k}>{r.rule}</Chip></td>
                  <td className="sub" style={{ maxWidth: 340 }}>{r.msg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="bet">
        <button className="btn sm" onClick={() => downloadFile("import-issues.csv",
          "Row,Check,Detail\n" + [...warn, ...err].map((r: any) => `${r.a},${r.rule},"${r.msg}"`).join("\n"))}>
          <Download size={12} />Issue report</button>
        <button className="btn pri" disabled={!keep.length} onClick={() => setDone(keep.length)}>
          <Send size={13} />{verb} {keep.length} {entity}</button>
      </div>
    </div>
  );
}

export { CsvImport }


