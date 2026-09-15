import { ImportPanel } from '@/components/data-io/ImportPanel'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Kpi } from '@/components/primitives/Kpi'
import { Modal } from '@/components/primitives/Modal'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { Toolbar } from '@/components/toolbar/Toolbar'
import { useAllItems } from '@/data/items'
import { ITEM_TEMPLATE } from '@/domain/templates'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import { AlertTriangle, Ban, Boxes, CheckCircle2, Clock, Database, Download, Layers, Plus, Upload } from 'lucide-react'
import React, { useState } from 'react'

/* ============================== ITEMS =============================== */

function ItemList({ go, railOpen = false, renderHeaderActions }: { go: any; railOpen?: boolean; renderHeaderActions?: () => React.ReactNode }) {
  const [q, setQ] = useState("");
  const [seg, setSeg] = useState("All");
  const [bulk, setBulk] = useState(false);
  const [itemPage, setItemPage] = useState(0);
  const segs = ["All", "In Production", "Discontinued", "Prototype", "Obsolete"];

  // Load all items from backend — one request, client-side filter/segment
  const { data: allItems, loading, error } = useAllItems();
  const items = allItems ?? [];

  // Client-side filter/search on the backend result
  const rows = items.filter((i: any) => (seg === "All" || i.phase === seg) &&
    (i.pn + i.name + i.cat).toLowerCase().includes(q.toLowerCase()));

  const count = (x: any) => (x === "All" ? items.length : items.filter((i: any) => i.phase === x).length);

  // Reset page when filter changes
  React.useEffect(() => { setItemPage(0); }, [q, seg]);

  return (
    <div className="stack" data-test-id="item-list-page">
      <div className="bet">
        <div>
          <div className="crumb">Items</div>
          <h1>Items</h1>
          <div className="sub" style={{ marginTop: 4 }}>Part number master data — every item tracked here syncs through to SAP</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => downloadFile("topcon-items.csv",
            "Item number,Revision,Item name,Category,Phase,Material status,Plant,Owner\n" +
            items.map((i: any) => [i.pn, i.rev, i.name, i.cat, i.phase, i.status, i.plant, i.owner].join(",")).join("\n"))}>
            <Download size={13} />Export</button>
          <button className="btn" onClick={() => setBulk(true)}><Upload size={13} />Bulk upload</button>
          <button className="btn pri" onClick={() => go({ page: "item-new" })}><Plus size={13} />Create item</button>
          {renderHeaderActions?.()}
        </div>
      </div>

      <div className="grid4">
        <Kpi label="In production" value={items.filter((i: any) => i.phase === "In Production").length}
          icon={CheckCircle2} tint={T.okBg} bd={T.okBd} tone={T.ok} />
        <Kpi label="Discontinued" value={items.filter((i: any) => i.phase === "Discontinued").length}
          icon={Clock} tint={T.warnBg} bd={T.warnBd} tone={T.warn} />
        <Kpi label="Obsolete" value={items.filter((i: any) => i.phase === "Obsolete").length}
          icon={Ban} tint={T.badBg} bd={T.badBd} tone={T.bad} />
        <Kpi label="Items with a BOM" value={items.filter((i: any) => i.bom > 0).length} icon={Layers} />
      </div>

      <Toolbar q={q} setQ={setQ} placeholder="Part number, name or category"
          segs={segs} seg={seg} setSeg={setSeg} count={count}
          selects={[["All categories", "KIT", "ASSEMBLY", "HARDWARE", "BRACKETS & PLATES", "PCB", "BATTERY"]]}
/>
      <Card pad={false}>
        <div className="scrollx">
          <table className="tbl">
            <thead><tr>
              <th>Item number</th>
              {!railOpen && <th>Rev</th>}
              <th>Item name</th>
              {!railOpen && <th>Category</th>}
              <th>Phase</th>
              {!railOpen && <th>SAP status</th>}
              {!railOpen && <th>Plant</th>}
              {!railOpen && <th>Owner</th>}
              {!railOpen && <th style={{ textAlign: "right" }}>BOM lines</th>}</tr></thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10}><Empty icon={Database} title="Loading items…" body="Fetching item master data from backend." /></td></tr>
              )}
              {Boolean(error) && (
                <tr><td colSpan={10}><Empty icon={AlertTriangle} title="Failed to load items" body="Check your connection and try refreshing." /></td></tr>
              )}
              {!loading && !error && rows.length === 0 && (
                <tr><td colSpan={10}><Empty icon={Boxes} title="No items match" body="Try a different search or lifecycle filter." /></td></tr>
              )}
              {!loading && !error && rows.slice(itemPage * PAGE_SIZE, (itemPage + 1) * PAGE_SIZE).map((it: any) => (
                <tr key={it.pn} data-test-id={`item-row-${it.pn}`}>
                  <td style={{ whiteSpace: "nowrap" }}><a className="pn" onClick={() => go({ page: "item", id: it.pn })}>{it.pn}</a></td>
                  {!railOpen && <td>{it.rev}</td>}
                  <td style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: railOpen ? 260 : undefined,
                  }} title={it.name}>{it.name}</td>
                  {!railOpen && <td className="sub">{it.cat}</td>}
                  <td style={{ whiteSpace: "nowrap" }}>{phaseChip(it.phase)}</td>
                  {!railOpen && <td><Chip k={it.status.startsWith("50") ? "bad" : "ok"}>{it.status}</Chip></td>}
                  {!railOpen && <td className="sub">{it.plant}</td>}
                  {!railOpen && <td className="sub">{it.owner}</td>}
                  {!railOpen && <td style={{ textAlign: "right" }}>{it.bom || <span className="mut">—</span>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination total={rows.length} page={itemPage} setPage={setItemPage} />
      </Card>

      {bulk && (
        <Modal title="Bulk upload items" wide onClose={() => setBulk(false)}
          foot={<><span className="sub">New items land in Design phase and need a change order before they reach SAP.</span>
            <button className="btn" style={{ marginLeft: "auto" }} onClick={() => setBulk(false)}>Close</button></>}>
          <ImportPanel template={ITEM_TEMPLATE} templateName="topcon-items-template.csv" entity="items" />
        </Modal>
      )}
    </div>
  );
}

export { ItemList }


