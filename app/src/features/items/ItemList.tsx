import { ImportPanel } from '@/components/data-io/ImportPanel'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Kpi } from '@/components/primitives/Kpi'
import { Modal } from '@/components/primitives/Modal'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { useAllBomItems } from '@/data/bomItems'
import { useAllItems } from '@/data/items'
import { ITEM_TEMPLATE } from '@/domain/templates'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import {
  AlertTriangle, Ban, Boxes, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  Clock, Database, Download, Layers, Package, Plus, Upload,
} from 'lucide-react'
import React, { useState } from 'react'

/* ============================== ITEMS =============================== */

const KIT_CAT = 'KIT'

/** One expandable kit row */
function KitRow({ it, go }: { it: any; go: any }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        className={open ? 'sel' : ''}
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
        data-test-id={`kit-row-${it.pn}`}
      >
        <td style={{ whiteSpace: 'nowrap', width: 32 }}>
          <span style={{ color: T.g500, display: 'inline-flex', alignItems: 'center' }}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <a className="pn" onClick={(e) => { e.stopPropagation(); go({ page: 'item', id: it.pn }) }}>{it.pn}</a>
        </td>
        <td>{it.rev}</td>
        <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{phaseChip(it.phase)}</td>
        <td><Chip k={it.status.startsWith('50') ? 'bad' : 'ok'}>{it.status}</Chip></td>
        <td className="sub">{it.plant}</td>
        <td style={{ textAlign: 'right' }}>{it.bom || <span className="mut">—</span>}</td>
      </tr>
      {open && (
        <tr data-test-id={`kit-detail-${it.pn}`}>
          <td colSpan={8} style={{ padding: 0, background: '#F8FAFC', borderBottom: `1px solid ${T.g200}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 0, padding: '12px 20px 14px 52px' }}>
              {[
                ['Owner', it.owner],
                ['Division', it.div],
                ['Category', it.cat],
                ['Procurement', it.proc],
                ['UOM', it.uom],
                ['Material group', it.mg],
                ['BOM usage', it.bomUsage],
                ['RoHS', it.rohs],
                ['ERP system', it.erpSystem],
                ['Assembly type', it.assemblyType],
                ['Cost', it.cost ? `$${it.cost}` : '—'],
                ['Created', it.created],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '4px 12px 4px 0' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.g500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ fontSize: 12, color: T.g900, marginTop: 2 }}>{val || '—'}</div>
                </div>
              ))}
              {it.description && (
                <div style={{ gridColumn: '1 / -1', padding: '4px 12px 4px 0', marginTop: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.g500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Description</div>
                  <div style={{ fontSize: 12, color: T.g900, marginTop: 2 }}>{it.description}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** One expandable BOM item row */
function BomItemRow({ bi }: { bi: any }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <tr
        className={open ? 'sel' : ''}
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
        data-test-id={`bom-item-row-${bi.id}`}
      >
        <td style={{ whiteSpace: 'nowrap', width: 32 }}>
          <span style={{ color: T.g500, display: 'inline-flex', alignItems: 'center' }}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        </td>
        <td style={{ whiteSpace: 'nowrap' }}><span className="pn">{bi.pn}</span></td>
        <td style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bi.name}>{bi.name}</td>
        <td className="sub">{bi.cat}</td>
        <td>{bi.qty}</td>
        <td className="sub">{bi.kitNumber}</td>
        <td className="sub">{bi.uom}</td>
      </tr>
      {open && (
        <tr data-test-id={`bom-item-detail-${bi.id}`}>
          <td colSpan={7} style={{ padding: 0, background: '#F8FAFC', borderBottom: `1px solid ${T.g200}` }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 0, padding: '12px 20px 14px 52px' }}>
              {[
                ['Part number', bi.pn],
                ['Kit number', bi.kitNumber],
                ['Category', bi.cat],
                ['Quantity', bi.qty],
                ['UOM', bi.uom],
                ['Ref designator', bi.refDes || '—'],
                ['Added', bi.addedAt],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '4px 12px 4px 0' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.g500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                  <div style={{ fontSize: 12, color: T.g900, marginTop: 2 }}>{val || '—'}</div>
                </div>
              ))}
              {bi.notes && (
                <div style={{ gridColumn: '1 / -1', padding: '4px 12px 4px 0', marginTop: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.g500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Notes</div>
                  <div style={{ fontSize: 12, color: T.g900, marginTop: 2 }}>{bi.notes}</div>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/** Collapsible section header — matches the admin submenu's accordion feel */
function SectionHeader({
  open, onToggle, title, count, icon: Ic, badge,
}: {
  open: boolean; onToggle: () => void; title: string; count: number; icon: any; badge?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      data-test-id={`section-toggle-${title.toLowerCase().replace(/\s+/g, '-')}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '11px 20px', background: '#F8FAFC',
        border: 'none', borderBottom: `1px solid ${T.g200}`,
        cursor: 'pointer', textAlign: 'left',
        transition: 'background .12s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#EEF4FB' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F8FAFC' }}
    >
      <Ic size={15} color={T.brand} strokeWidth={2} />
      <span style={{ fontSize: 13, fontWeight: 600, color: T.g900, flex: 1 }}>{title}</span>
      {badge}
      <span style={{ fontSize: 11, color: T.g500, marginLeft: 4 }}>{count} record{count !== 1 ? 's' : ''}</span>
      <span style={{ color: T.g500, display: 'inline-flex', alignItems: 'center', marginLeft: 6 }}>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </span>
    </button>
  )
}

function ItemList({ go, railOpen = false, renderHeaderActions }: { go: any; railOpen?: boolean; renderHeaderActions?: () => React.ReactNode }) {
  const [bulk, setBulk] = useState(false)
  const [kitsOpen, setKitsOpen] = useState(true)
  const [bomOpen, setBomOpen] = useState(true)
  const [kitQ, setKitQ] = useState('')
  const [bomQ, setBomQ] = useState('')
  const [kitPage, setKitPage] = useState(0)
  const [bomPage, setBomPage] = useState(0)

  // Kits — from item object, cat = KIT
  const { data: allItems, loading: itemsLoading, error: itemsError } = useAllItems()
  const kits = (allItems ?? []).filter((i: any) => i.cat === KIT_CAT)
  const filteredKits = kits.filter((i: any) =>
    (i.pn + ' ' + i.name).toLowerCase().includes(kitQ.toLowerCase()))

  // Items inside kits — from bom_item object
  const { bomItems, loading: bomLoading, error: bomError } = useAllBomItems()
  const filteredBom = bomItems.filter((bi) =>
    (bi.pn + ' ' + bi.name + ' ' + bi.kitNumber).toLowerCase().includes(bomQ.toLowerCase()))

  // KPI counts from the Kits set
  const kitsInProd = kits.filter((i: any) => i.phase === 'In Production').length
  const kitsDiscontinued = kits.filter((i: any) => i.phase === 'Discontinued').length
  const kitsObsolete = kits.filter((i: any) => i.phase === 'Obsolete').length

  React.useEffect(() => { setKitPage(0) }, [kitQ])
  React.useEffect(() => { setBomPage(0) }, [bomQ])

  return (
    <div className="stack" data-test-id="item-list-page">
      {/* Page header */}
      <div className="bet">
        <div>
          <div className="crumb">Items</div>
          <h1>Items</h1>
          <div className="sub" style={{ marginTop: 4 }}>
            Kits and their component items — sourced from the item master and BOM records
          </div>
        </div>
        <div className="row">
          <button
            className="btn"
            onClick={() => downloadFile('topcon-kits.csv',
              'Kit number,Rev,Name,Phase,SAP status,Plant,Owner,BOM lines\n' +
              kits.map((i: any) => [i.pn, i.rev, i.name, i.phase, i.status, i.plant, i.owner, i.bom].join(',')).join('\n')
            )}
            data-test-id="export-kits-btn"
          >
            <Download size={13} />Export kits
          </button>
          <button className="btn" onClick={() => setBulk(true)} data-test-id="bulk-upload-btn">
            <Upload size={13} />Bulk upload
          </button>
          <button className="btn pri" onClick={() => go({ page: 'item-new' })} data-test-id="create-item-btn">
            <Plus size={13} />Create item
          </button>
          {renderHeaderActions?.()}
        </div>
      </div>

      {/* KPI bar — kit lifecycle counts */}
      <div className="grid4" data-test-id="items-kpis">
        <Kpi label="Kits in production" value={kitsInProd} icon={CheckCircle2} tint={T.okBg} bd={T.okBd} tone={T.ok} />
        <Kpi label="Kits discontinued" value={kitsDiscontinued} icon={Clock} tint={T.warnBg} bd={T.warnBd} tone={T.warn} />
        <Kpi label="Kits obsolete" value={kitsObsolete} icon={Ban} tint={T.badBg} bd={T.badBd} tone={T.bad} />
        <Kpi label="BOM line items" value={bomItems.length} icon={Layers} />
      </div>

      {/* ── SECTION 1: Kits ───────────────────────────────────────── */}
      <Card pad={false} data-test-id="kits-section">
        <SectionHeader
          open={kitsOpen}
          onToggle={() => setKitsOpen((v) => !v)}
          title="Kits"
          count={filteredKits.length}
          icon={Boxes}
        />
        {kitsOpen && (
          <>
            {/* Kit search */}
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${T.g100}`, display: 'flex', alignItems: 'center', gap: 10 }} data-test-id="kits-search-bar">
              <input
                placeholder="Search kit number or name…"
                value={kitQ}
                onChange={(e) => setKitQ(e.target.value)}
                data-test-id="kits-search-input"
                style={{ height: 32, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.g200}`, fontSize: 13, color: T.g900, background: '#fff', outline: 'none', width: 280 }}
              />
            </div>
            <div className="scrollx">
              <table className="tbl" data-test-id="kits-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Kit number</th>
                    <th>Rev</th>
                    <th>Kit name</th>
                    <th>Phase</th>
                    <th>SAP status</th>
                    <th>Plant</th>
                    <th style={{ textAlign: 'right' }}>BOM lines</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsLoading && (
                    <tr><td colSpan={8}><Empty icon={Database} title="Loading kits…" body="Fetching kit master data from backend." /></td></tr>
                  )}
                  {Boolean(itemsError) && (
                    <tr><td colSpan={8}><Empty icon={AlertTriangle} title="Failed to load kits" body="Check your connection and try refreshing." /></td></tr>
                  )}
                  {!itemsLoading && !itemsError && filteredKits.length === 0 && (
                    <tr><td colSpan={8}><Empty icon={Boxes} title="No kits match" body="Try a different search term." /></td></tr>
                  )}
                  {!itemsLoading && !itemsError && filteredKits
                    .slice(kitPage * PAGE_SIZE, (kitPage + 1) * PAGE_SIZE)
                    .map((it: any) => (
                      <KitRow key={it.pn} it={it} go={go} />
                    ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination total={filteredKits.length} page={kitPage} setPage={setKitPage} />
          </>
        )}
      </Card>

      {/* ── SECTION 2: Items inside Kits ──────────────────────────── */}
      <Card pad={false} data-test-id="bom-items-section">
        <SectionHeader
          open={bomOpen}
          onToggle={() => setBomOpen((v) => !v)}
          title="Items inside Kits"
          count={filteredBom.length}
          icon={Package}
        />
        {bomOpen && (
          <>
            {/* BOM item search */}
            <div style={{ padding: '10px 20px', borderBottom: `1px solid ${T.g100}`, display: 'flex', alignItems: 'center', gap: 10 }} data-test-id="bom-search-bar">
              <input
                placeholder="Search part number, name or kit…"
                value={bomQ}
                onChange={(e) => setBomQ(e.target.value)}
                data-test-id="bom-search-input"
                style={{ height: 32, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.g200}`, fontSize: 13, color: T.g900, background: '#fff', outline: 'none', width: 280 }}
              />
            </div>
            <div className="scrollx">
              <table className="tbl" data-test-id="bom-items-table">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}></th>
                    <th>Part number</th>
                    <th>Item name</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Kit number</th>
                    <th>UOM</th>
                  </tr>
                </thead>
                <tbody>
                  {bomLoading && (
                    <tr><td colSpan={7}><Empty icon={Database} title="Loading items…" body="Fetching BOM line items from backend." /></td></tr>
                  )}
                  {Boolean(bomError) && (
                    <tr><td colSpan={7}><Empty icon={AlertTriangle} title="Failed to load items" body="Check your connection and try refreshing." /></td></tr>
                  )}
                  {!bomLoading && !bomError && filteredBom.length === 0 && (
                    <tr><td colSpan={7}><Empty icon={Package} title="No items match" body="Try a different search term." /></td></tr>
                  )}
                  {!bomLoading && !bomError && filteredBom
                    .slice(bomPage * PAGE_SIZE, (bomPage + 1) * PAGE_SIZE)
                    .map((bi) => (
                      <BomItemRow key={bi.id} bi={bi} />
                    ))
                  }
                </tbody>
              </table>
            </div>
            <Pagination total={filteredBom.length} page={bomPage} setPage={setBomPage} />
          </>
        )}
      </Card>

      {bulk && (
        <Modal title="Bulk upload items" wide onClose={() => setBulk(false)}
          foot={
            <>
              <span className="sub">New items land in Design phase and need a change order before they reach SAP.</span>
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setBulk(false)}>Close</button>
            </>
          }
        >
          <ImportPanel template={ITEM_TEMPLATE} templateName="topcon-items-template.csv" entity="items" />
        </Modal>
      )}
    </div>
  )
}

export { ItemList }


