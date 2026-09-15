import { ImportPanel } from '@/components/data-io/ImportPanel'
import { Card } from '@/components/primitives/Card'
import { Chip, phaseChip } from '@/components/primitives/Chip'
import { Empty } from '@/components/primitives/Empty'
import { Kpi } from '@/components/primitives/Kpi'
import { Modal } from '@/components/primitives/Modal'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { useAllItems } from '@/data/items'
import { ITEM_TEMPLATE } from '@/domain/templates'
import { T } from '@/theme/tokens'
import {
  AlertTriangle, Ban, Boxes, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Database, Download, Layers, Plus, Upload,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

/* ============================== KIT LIST ============================== */

const KIT_CAT = 'KIT'

function exportKitsToExcel(kits: any[]) {
  const rows = kits.map((k) => ({
    'Kit number': k.pn,
    'Revision': k.rev,
    'Kit name': k.name,
    'Category': k.cat,
    'Phase': k.phase,
    'SAP status': k.status,
    'Plant': k.plant,
    'Owner': k.owner,
    'Division': k.div,
    'Procurement': k.proc,
    'UOM': k.uom,
    'Material group': k.mg,
    'BOM usage': k.bomUsage,
    'RoHS': k.rohs,
    'ERP system': k.erpSystem,
    'Assembly type': k.assemblyType,
    'Standard cost': k.cost,
    'Created': k.created,
    'BOM lines': k.bom,
    'Description': k.description,
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Kits')
  XLSX.writeFile(wb, 'topcon-kits.xlsx')
}

function KitRow({ it, go }: { it: any; go: any }) {
  const [open, setOpen] = useState(false)

  const details: [string, string][] = [
    ['Owner', it.owner],
    ['Division', it.div],
    ['Procurement', it.proc],
    ['UOM', it.uom],
    ['Material group', it.mg],
    ['BOM usage', it.bomUsage],
    ['RoHS', it.rohs],
    ['ERP system', it.erpSystem],
    ['Assembly type', it.assemblyType],
    ['Cost', it.cost ? `$${it.cost}` : '—'],
    ['Created', it.created],
    ['Primary file', it.primaryFile || '—'],
  ]

  return (
    <>
      <tr
        className={open ? 'sel' : ''}
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
        data-test-id={`kit-row-${it.pn}`}
      >
        <td style={{ width: 32, paddingRight: 0 }}>
          <span style={{ color: T.g400, display: 'inline-flex', alignItems: 'center' }}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <a
            className="pn"
            onClick={(e) => { e.stopPropagation(); go({ page: 'item', id: it.pn }) }}
            data-test-id={`kit-pn-link-${it.pn}`}
          >
            {it.pn}
          </a>
        </td>
        <td className="sub">{it.rev}</td>
        <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>
          {it.name}
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>{phaseChip(it.phase)}</td>
        <td>
          <Chip k={it.status.startsWith('50') ? 'bad' : it.status.startsWith('10') ? 'warn' : 'ok'}>
            {it.status}
          </Chip>
        </td>
        <td className="sub" style={{ whiteSpace: 'nowrap' }}>{it.plant}</td>
        <td className="sub">{it.owner}</td>
        <td style={{ textAlign: 'right' }}>{it.bom > 0 ? it.bom : <span style={{ color: T.g400 }}>—</span>}</td>
      </tr>
      {open && (
        <tr data-test-id={`kit-detail-${it.pn}`}>
          <td colSpan={9} style={{ padding: 0, background: '#F8FAFC', borderBottom: `1px solid ${T.g100}` }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              padding: '12px 20px 14px 52px',
              gap: '8px 0',
            }}>
              {details.map(([label, val]) => (
                <div key={label} style={{ paddingRight: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.g500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                  <div style={{ fontSize: 12, color: T.g900, marginTop: 2 }}>{val || '—'}</div>
                </div>
              ))}
              {it.description && (
                <div style={{ gridColumn: '1 / -1', paddingRight: 16, marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.g500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</div>
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

function KitList({ go, renderHeaderActions }: { go: any; renderHeaderActions?: () => React.ReactNode }) {
  const [q, setQ] = useState('')
  const [seg, setSeg] = useState('All')
  const [bulk, setBulk] = useState(false)
  const [page, setPage] = useState(0)

  const { data: allItems, loading, error } = useAllItems()

  // All kits from the item object where cat = KIT
  const kits = useMemo(() => (allItems ?? []).filter((i: any) => i.cat === KIT_CAT), [allItems])

  const filteredKits = useMemo(() => kits.filter((i: any) => {
    const matchesSeg = seg === 'All' || i.phase === seg
    const matchesQ = (i.pn + ' ' + i.name + ' ' + i.div).toLowerCase().includes(q.toLowerCase())
    return matchesSeg && matchesQ
  }), [kits, q, seg])

  React.useEffect(() => { setPage(0) }, [q, seg])

  const inProd = kits.filter((i: any) => i.phase === 'In Production').length
  const discontinued = kits.filter((i: any) => i.phase === 'Discontinued').length
  const obsolete = kits.filter((i: any) => i.phase === 'Obsolete').length
  const withBom = kits.filter((i: any) => i.bom > 0).length

  const SEGS = ['All', 'In Production', 'Discontinued', 'Prototype', 'Obsolete']
  const countForSeg = (s: string) => s === 'All' ? kits.length : kits.filter((i: any) => i.phase === s).length

  return (
    <div className="stack" data-test-id="kit-list-page">
      {/* Header */}
      <div className="bet">
        <div>
          <div className="crumb">Items · Kits</div>
          <h1>Kits</h1>
          <div className="sub" style={{ marginTop: 4 }}>
            Kit assemblies from the item master — {kits.length} total
          </div>
        </div>
        <div className="row">
          <button
            className="btn"
            onClick={() => exportKitsToExcel(kits)}
            data-test-id="export-kits-btn"
            disabled={kits.length === 0}
          >
            <Download size={13} />Export to Excel
          </button>
          <button className="btn" onClick={() => setBulk(true)} data-test-id="bulk-upload-btn">
            <Upload size={13} />Bulk upload
          </button>
          <button className="btn pri" onClick={() => go({ page: 'item-new' })} data-test-id="create-kit-btn">
            <Plus size={13} />Create item
          </button>
          {renderHeaderActions?.()}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid4" data-test-id="kit-kpis">
        <Kpi label="In production" value={inProd} icon={CheckCircle2} tint={T.okBg} bd={T.okBd} tone={T.ok} />
        <Kpi label="Discontinued" value={discontinued} icon={Clock} tint={T.warnBg} bd={T.warnBd} tone={T.warn} />
        <Kpi label="Obsolete" value={obsolete} icon={Ban} tint={T.badBg} bd={T.badBd} tone={T.bad} />
        <Kpi label="Kits with a BOM" value={withBom} icon={Layers} />
      </div>

      {/* Toolbar */}
      <div className="toolbar" data-test-id="kit-toolbar">
        <div className="seg" data-test-id="kit-seg">
          {SEGS.map((s) => (
            <button
              key={s}
              type="button"
              className={seg === s ? 'on' : ''}
              onClick={() => setSeg(s)}
              data-test-id={`kit-seg-${s.toLowerCase().replace(/\s/g, '-')}`}
            >
              <span>{s}</span>
              <span className="n">{countForSeg(s)}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <input
            placeholder="Search kit number or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search kits"
            data-test-id="kit-search-input"
            style={{ height: 32, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.g200}`, fontSize: 13, color: T.g900, background: '#fff', outline: 'none', width: 240 }}
          />
        </div>
      </div>

      {/* Table */}
      <Card pad={false} data-test-id="kit-table-card">
        <div className="scrollx">
          <table className="tbl" data-test-id="kit-table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Kit number</th>
                <th>Rev</th>
                <th>Kit name</th>
                <th>Phase</th>
                <th>SAP status</th>
                <th>Plant</th>
                <th>Owner</th>
                <th style={{ textAlign: 'right' }}>BOM lines</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9}><Empty icon={Database} title="Loading kits…" body="Fetching kit master data from the backend." /></td></tr>
              )}
              {Boolean(error) && (
                <tr><td colSpan={9}><Empty icon={AlertTriangle} title="Failed to load kits" body="Check your connection and try refreshing." /></td></tr>
              )}
              {!loading && !error && filteredKits.length === 0 && (
                <tr><td colSpan={9}><Empty icon={Boxes} title="No kits match" body="Try a different search or lifecycle filter." /></td></tr>
              )}
              {!loading && !error && filteredKits
                .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                .map((it: any) => <KitRow key={it.id} it={it} go={go} />)
              }
            </tbody>
          </table>
        </div>
        <Pagination total={filteredKits.length} page={page} setPage={setPage} />
      </Card>

      {bulk && (
        <Modal
          title="Bulk upload kits"
          wide
          onClose={() => setBulk(false)}
          foot={
            <>
              <span className="sub">New items land in Design phase and need a change order before they reach SAP.</span>
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setBulk(false)}>Close</button>
            </>
          }
        >
          <ImportPanel template={ITEM_TEMPLATE} templateName="topcon-kits-template.csv" entity="kits" />
        </Modal>
      )}
    </div>
  )
}

export { KitList }
