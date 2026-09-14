import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Kpi } from '@/components/primitives/Kpi'
import { CHECKS, EXCEL_ROWS } from '@/domain/ecos'
import { ME } from '@/domain/session'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import { AlertTriangle, Ban, Check, CheckCircle2, Download, FileSpreadsheet, Trash2, Upload, X } from 'lucide-react'
import { useState } from 'react'

/* upload → validate → resolve → add. Shared by the ECO import and item bulk upload */
function ImportPanel({ template, templateName, entity = "items", onAdd, columns }: any) {
  const [file, setFile] = useState<any>(null);
  const [skip, setSkip] = useState<any[]>([]);
  const [added, setAdded] = useState(0);
  const ok = EXCEL_ROWS.filter((r: any) => r.sev === "ok");
  const warn = EXCEL_ROWS.filter((r: any) => r.sev === "warn");
  const err = EXCEL_ROWS.filter((r: any) => r.sev === "err");
  const keep = [...ok, ...warn.filter((r: any) => !skip.includes(r.pn))];

  if (added) return (
    <div className="stack">
      <div className="okbox">
        <CheckCircle2 size={15} />
        <div><b>{added} {entity} added.</b> {err.length} blocked rows and {skip.length} skipped warnings were left out.</div>
      </div>
      <button className="btn" style={{ alignSelf: "flex-start" }}
        onClick={() => { setFile(null); setAdded(0); setSkip([]); }}><Upload size={13} />Upload another file</button>
    </div>
  );

  if (!file) return (
    <div className="stack">
      <button className="drop" onClick={() => setFile("AgKits_Status50.xlsx")}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: T.b50, display: "grid", placeItems: "center", margin: "0 auto" }}>
          <Upload size={20} color={T.brand} />
        </span>
        <div style={{ fontWeight: 600, marginTop: 11 }}>Drop an Excel or CSV file, or choose a file</div>
        <div className="sub" style={{ marginTop: 4 }}>One row per part number · up to 5,000 rows</div>
      </button>
      <div className="bet">
        <span className="sub">Every row is checked before anything is written.</span>
        <button className="btn" onClick={() => downloadFile(templateName, template)}>
          <Download size={13} />Download template</button>
      </div>
    </div>
  );

  return (
    <div className="stack">
      <div className="bet">
        <div className="row">
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.okBg, display: "grid", placeItems: "center" }}>
            <FileSpreadsheet size={16} color={T.ok} />
          </span>
          <div><b>{file}</b><div className="mini">{EXCEL_ROWS.length} rows read · {ME.name} · 11 Sep 09:14</div></div>
        </div>
        <button className="btn gh sm" onClick={() => { setFile(null); setSkip([]); }}><Trash2 size={12} />Remove file</button>
      </div>

      <div className="grid3">
        <Kpi label="Ready to add" value={ok.length} icon={Check} />
        <Kpi label="Needs a decision" value={warn.length} icon={AlertTriangle} />
        <Kpi label="Blocked" value={err.length} icon={X} />
      </div>

      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr>
            <th style={{ width: 34 }}>Add</th><th>Item number</th><th>Item name</th><th>Rev</th><th>Phase</th>
            <th>Check</th><th>Detail</th>
          </tr></thead>
          <tbody>
            {[...warn, ...ok, ...err].map((r: any) => {
              const blocked = r.sev === "err";
              const on = !blocked && !skip.includes(r.pn);
              return (
                <tr key={r.pn} style={blocked ? { opacity: .62 } : undefined}>
                  <td>{blocked ? <Ban size={13} color={T.g400} />
                    : <input type="checkbox" checked={on} onChange={() =>
                        setSkip(on ? [...skip, r.pn] : skip.filter((x: any) => x !== r.pn))} />}</td>
                  <td className="pn">{r.pn}</td>
                  <td>{r.name}</td>
                  <td>{r.rev}</td>
                  <td>{r.phase === "—" ? <span className="mut">—</span> : phaseChip(r.phase)}</td>
                  <td><Chip k={CHECKS[r.sev].k} icon={r.sev === "ok" ? Check : r.sev === "warn" ? AlertTriangle : X}>{r.rule}</Chip></td>
                  <td className="sub" style={{ maxWidth: 420 }}>{r.msg}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bet">
        <div className="row" style={{ gap: 8 }}>
          <button className="btn sm" onClick={() => setSkip(warn.map((r: any) => r.pn))}>Skip all warnings</button>
          <button className="btn sm" onClick={() => setSkip([])}>Include all warnings</button>
          <button className="btn sm" onClick={() => downloadFile("import-issues.csv",
            "Item number,Check,Detail\n" + [...warn, ...err].map((r: any) => `${r.pn},${r.rule},"${r.msg}"`).join("\n"))}>
            <Download size={12} />Issue report</button>
        </div>
        <button className="btn pri" disabled={!keep.length} onClick={() => { setAdded(keep.length); onAdd && onAdd(keep); }}>
          <Check size={13} />Add {keep.length} {entity}</button>
      </div>
    </div>
  );
}

export { ImportPanel }


