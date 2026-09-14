import { Chip } from '@/components/primitives/Chip'
import { T } from '@/theme/tokens'
import { Search, X } from 'lucide-react'
import { useState } from 'react'

/** Like MemberPicker but stores/receives user-record IDs and resolves names from a users list. */
function IdMemberPicker({ value, onChange, users }: any) {
  const [q, setQ] = useState("");
  const list = (users ?? []).filter((u: any) => (u.name + u.group + u.site).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      {value.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 9 }}>
          {value.map((id: any) => {
            const u = users.find((x: any) => x.id === id);
            const label = u ? u.name : id;
            return (
              <span key={id} className="chip c-blue" style={{ paddingRight: 4 }}>
                {label}
                <button className="chipx" onClick={() => onChange(value.filter((x: any) => x !== id))}><X size={10} /></button>
              </span>
            );
          })}
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
            {list.map((u: any) => {
              const on = value.includes(u.id);
              return (
                <tr key={u.id} className={on ? "sel" : ""} onClick={() => onChange(on ? value.filter((x: any) => x !== u.id) : [...value, u.id])}>
                  <td style={{ width: 30 }}><input type="checkbox" checked={on} readOnly /></td>
                  <td><div style={{ fontWeight: 600 }}>{u.name}</div><div className="mini">{u.group} · {u.site}</div></td>
                  <td style={{ textAlign: "right" }}>{u.active === false && <Chip k="bad">Disabled</Chip>}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td className="sub" style={{ padding: 16 }}>No one matches "{q}".</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export { IdMemberPicker }


