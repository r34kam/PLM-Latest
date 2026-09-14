import { Select } from '@/components/primitives/Field'
import { T } from '@/theme/tokens'
import { Check, FileText, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'

/* file attach — used on change orders and items */
function FileUpload({ existing = [], onClose, context }: any) {
  const [files, setFiles] = useState(existing);
  const [staged, setStaged] = useState<any[]>([]);
  const SAMPLE = [
    { n: "1003140-01_revC_assembly.pdf", size: "412 KB", type: "Drawing" },
    { n: "CG1-mounting-instructions.docx", size: "88 KB", type: "Work instruction" },
    { n: "INSP-2026-0448.pdf", size: "1.2 MB", type: "Inspection report" },
  ];
  return (
    <div className="stack">
      <button className="drop" onClick={() => setStaged([...staged, SAMPLE[staged.length % 3]])}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: T.b50, display: "grid", placeItems: "center", margin: "0 auto" }}>
          <Upload size={20} color={T.brand} /></span>
        <div style={{ fontWeight: 600, marginTop: 11 }}>Drop files here, or choose files</div>
        <div className="sub" style={{ marginTop: 4 }}>PDF, DWG, STEP, Office documents and images · up to 100 MB each</div>
      </button>

      {staged.length > 0 && (
        <div className="card" style={{ overflow: "hidden" }}>
          <table className="tbl">
            <thead><tr><th>File</th><th style={{ width: 190 }}>File type</th><th style={{ width: 150 }}>Visibility</th><th style={{ width: 90 }}>Primary</th><th style={{ width: 44 }}></th></tr></thead>
            <tbody>
              {staged.map((f: any, k: any) => (
                <tr key={k}>
                  <td><div className="row" style={{ gap: 9 }}>
                    <span style={{ width: 28, height: 28, borderRadius: 8, background: T.b50, display: "grid", placeItems: "center" }}>
                      <FileText size={14} color={T.brand} /></span>
                    <div><div style={{ fontWeight: 600 }}>{f.n}</div><div className="mini">{f.size}</div></div>
                  </div></td>
                  <td><Select style={{ height: 28 }} options={["Drawing", "Work instruction", "Inspection report", "Specification", "Certificate", "Other"]} /></td>
                  <td><Select style={{ height: 28 }} options={["Internal only", "Share with suppliers"]} /></td>
                  <td style={{ textAlign: "center" }}><input type="radio" name="primary" defaultChecked={k === 0} /></td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn gh sm" onClick={() => setStaged(staged.filter((_: any, j: any) => j !== k))}><Trash2 size={12} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note">Files attached to {context} are versioned. Replacing one keeps the previous version in history rather than
        overwriting it.</div>

      <div className="bet">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={!staged.length} onClick={onClose}>
          <Check size={13} />Attach {staged.length || ""} file{staged.length === 1 ? "" : "s"}</button>
      </div>
    </div>
  );
}

export { FileUpload }


