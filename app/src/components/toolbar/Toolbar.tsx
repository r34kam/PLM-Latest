import { Select } from '@/components/primitives/Field'
import { T } from '@/theme/tokens'
import { Search, X } from 'lucide-react'

/* one toolbar pattern for every table in the app */
function Toolbar({ q, setQ, placeholder = "Search", segs, seg, setSeg, count, selects = [], right,
  selected = 0, onClearSel, bulk }: any) {
  return (
    <div className="toolbar">
      {segs && (
        <div className="seg">
          {segs.map((x: any) => (
            <button key={x} type="button" className={seg === x ? "on" : ""} onClick={() => setSeg(x)}>
              <span>{x}</span>{count && <span className="n">{count(x)}</span>}
            </button>
          ))}
        </div>
      )}
      {setQ && (
        <div className="srch">
          <Search size={14} color={T.g500} />
          <input className="inp" placeholder={placeholder} value={q} onChange={(e: any) => setQ(e.target.value)} />
          {q && <button className="clr" onClick={() => setQ("")}><X size={12} /></button>}
        </div>
      )}
      {selects.map((o: any, k: any) => <Select key={k} options={o} style={{ width: 165, height: 32 }} />)}
      {selected > 0 && (
        <div className="seltray">
          <span>{selected} selected</span>
          {bulk}
          <button className="btn gh sm" onClick={onClearSel}><X size={12} /></button>
        </div>
      )}
      {right && <div className="row" style={{ marginLeft: "auto", gap: 8 }}>{right}</div>}
    </div>
  );
}

export { Toolbar }


