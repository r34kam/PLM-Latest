import { Chip } from '@/components/primitives/Chip'
import { PEOPLE } from '@/domain/people'
import { T } from '@/theme/tokens'
import { Search, X } from 'lucide-react'
import { useState } from 'react'

/* ---------- member picker used by both role and routing editors ---------- */
function MemberPicker({ value, onChange }: any) {
  const [q, setQ] = useState("");
  const list = PEOPLE.filter((p: any) => (p.n + p.g + p.s).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      {value.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 9 }}>
          {value.map((n: any) => (
            <span key={n} className="chip c-blue" style={{ paddingRight: 4 }}>
              {n}
              <button className="chipx" onClick={() => onChange(value.filter((x: any) => x !== n))}><X size={10} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="srch" style={{ marginBottom: 8 }}>
        <Search size={14} color={T.g500} />
        <input className="inp" style={{ width: "100%" }} placeholder="Search people by name, group or site"
          value={q} onChange={(e: any) => setQ(e.target.value)} />
      </div>
      <div style={{ maxHeight: 210, overflow: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <table className="tbl">
          <tbody>
            {list.map((p: any) => {
              const on = value.includes(p.n);
              return (
                <tr key={p.n} className={on ? "sel" : ""} onClick={() => onChange(on ? value.filter((x: any) => x !== p.n) : [...value, p.n])}>
                  <td style={{ width: 30 }}><input type="checkbox" checked={on} readOnly /></td>
                  <td><div style={{ fontWeight: 600 }}>{p.n}</div><div className="mini">{p.g} · {p.s}</div></td>
                  <td style={{ textAlign: "right" }}>{p.off && <Chip k="bad">Disabled</Chip>}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td className="sub" style={{ padding: 16 }}>No one matches “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { MemberPicker }


