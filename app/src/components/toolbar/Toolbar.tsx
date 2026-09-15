import { Select } from '@/components/primitives/Field'
import { T } from '@/theme/tokens'
import { Search, X } from 'lucide-react'

/* Toolbar — one consistent pattern for every table in the app.
   Layout: [filter pills] [select dropdowns]  ···  [search] [extra actions]
   Filters and pills sit on the left; search bar and the `right` slot are
   pushed to the far right. This matches the request: filters left, search right. */
function Toolbar({ q, setQ, placeholder = "Search", segs, seg, setSeg, count, selects = [], right,
  selected = 0, onClearSel, bulk }: any) {
  return (
    <div className="toolbar" data-test-id="toolbar">
      {/* ── Left: filter pills + select dropdowns ── */}
      {segs && (
        <div className="seg" data-test-id="toolbar-seg">
          {segs.map((x: any) => (
            <button key={x} type="button" className={seg === x ? "on" : ""} onClick={() => setSeg(x)}
              data-test-id={`seg-${x.toLowerCase().replace(/\s+/g, '-')}`}>
              {x}
            </button>
          ))}
        </div>
      )}
      {selects.map((o: any, k: any) => <Select key={k} options={o} style={{ width: 165, height: 32 }} />)}

      {/* ── Right: selection tray, search, extra actions ── */}
      <div className="toolbar-right">
        {selected > 0 && (
          <div className="seltray" data-test-id="toolbar-seltray">
            <span>{selected} selected</span>
            {bulk}
            <button className="btn gh sm" onClick={onClearSel}><X size={12} /></button>
          </div>
        )}
        {setQ && (
          <div className="srch" data-test-id="toolbar-search">
            <Search size={14} color={T.g500} />
            <input className="inp" placeholder={placeholder} value={q} onChange={(e: any) => setQ(e.target.value)} />
            {q && <button className="clr" onClick={() => setQ("")}><X size={12} /></button>}
          </div>
        )}
        {right && <div className="row" style={{ gap: 8 }}>{right}</div>}
      </div>
    </div>
  );
}

export { Toolbar }


