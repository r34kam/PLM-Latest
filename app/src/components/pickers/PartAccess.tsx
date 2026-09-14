import { Chip } from '@/components/primitives/Chip'
import { ITEMS } from '@/domain/catalog'
import { T } from '@/theme/tokens'
import { Search, X } from 'lucide-react'
import { useState } from 'react'

/* ============================ SUPPLIERS ============================= */

function PartAccess({ value, onChange }: any) {
  const [q, setQ] = useState("");
  const list = ITEMS.filter((i: any) => (i.pn + i.name + i.cat).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      {value.length > 0 && (
        <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 9 }}>
          {value.map((pn: any) => (
            <span key={pn} className="chip c-blue" style={{ paddingRight: 4 }}>{pn}
              <button className="chipx" onClick={() => onChange(value.filter((x: any) => x !== pn))}><X size={10} /></button></span>
          ))}
        </div>
      )}
      <div className="srch" style={{ marginBottom: 8 }}>
        <Search size={14} color={T.g500} />
        <input className="inp" style={{ width: "100%" }} placeholder="Search items by part number, name or category"
          value={q} onChange={(e: any) => setQ(e.target.value)} />
      </div>
      <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid #E2E8F0", borderRadius: 10 }}>
        <table className="tbl">
          <tbody>
            {list.map((i: any) => {
              const on = value.includes(i.pn);
              return (
                <tr key={i.pn} className={on ? "sel" : ""} onClick={() => onChange(on ? value.filter((x: any) => x !== i.pn) : [...value, i.pn])}>
                  <td style={{ width: 30 }}><input type="checkbox" checked={on} readOnly /></td>
                  <td><span className="pn">{i.pn}</span><div className="mini">{i.name}</div></td>
                  <td className="sub">{i.cat}</td>
                  <td style={{ textAlign: "right" }}>{i.bom > 0 && <Chip k="gray">Has BOM</Chip>}</td>
                </tr>
              );
            })}
            {!list.length && <tr><td className="sub" style={{ padding: 16 }}>No items match “{q}”.</td></tr>}
          </tbody>
        </table>
      </div>
      <label className="row" style={{ marginTop: 9, fontSize: 13 }}>
        <input type="checkbox" defaultChecked /> Also let them see the BOM of any assembly shared above
      </label>
    </div>
  );
}

export { PartAccess }


