import { Empty } from '@/components/primitives/Empty'
import { Select } from '@/components/primitives/Field'
import { suppliersFor } from '@/domain/suppliers'
import { Users } from 'lucide-react'

/* supplier sharing — derived from which supplier supplies which part on the change */
function SupplierShare({ pns, value, onChange, compact }: any) {
  const found = suppliersFor(pns);
  return (
    <div className="stack">
      {found.length === 0 ? (
        <Empty icon={Users} title="No supplier is mapped to these parts"
          body="Sourcing records drive this list. Kits assembled in house carry no supplier, so there is nothing to share." />
      ) : (
        <>
          {!compact && <div className="sub">
            {found.length} supplier{found.length === 1 ? "" : "s"} supply parts on this change. Tick the ones who should see it —
            each sees only their own parts, never another supplier’s.
          </div>}
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead><tr><th style={{ width: 34 }}></th><th>Supplier</th><th>Parts they supply on this change</th>
                <th style={{ width: 150 }}>Access</th><th style={{ width: 165 }}>Notify on</th></tr></thead>
              <tbody>
                {found.map((f: any) => {
                  const on = value.includes(f.n);
                  return (
                    <tr key={f.n} className={on ? "sel" : ""}>
                      <td><input type="checkbox" checked={on}
                        onChange={() => onChange(on ? value.filter((x: any) => x !== f.n) : [...value, f.n])} /></td>
                      <td style={{ fontWeight: 600 }}>{f.n}</td>
                      <td><div className="row" style={{ flexWrap: "wrap", gap: 5 }}>
                        {f.parts.map((pn: any) => <span key={pn} className="chip c-blue">{pn}</span>)}</div></td>
                      <td><Select style={{ height: 28 }} disabled={!on} options={["View only", "View and comment", "Approve"]} /></td>
                      <td><Select style={{ height: 28 }} disabled={!on} options={["Change complete", "Every status change"]} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="note">A part can come from more than one supplier — 1006394-01 is dual sourced, so both appear.
            Suppliers are not notified while the change is still in routing.</div>
        </>
      )}
    </div>
  );
}

export { SupplierShare }


