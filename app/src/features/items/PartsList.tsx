import { ImportPanel } from '@/components/data-io/ImportPanel'
import { Card } from '@/components/primitives/Card'
import { Empty } from '@/components/primitives/Empty'
import { Kpi } from '@/components/primitives/Kpi'
import { Modal } from '@/components/primitives/Modal'
import { PAGE_SIZE, Pagination } from '@/components/primitives/Pagination'
import { useAllBomItems } from '@/data/bomItems'
import { useExportData } from '@/data/export'
import { BOM_ITEM_TEMPLATE } from '@/domain/templates'
import { T } from '@/theme/tokens'
import {
  AlertTriangle, ChevronDown, ChevronRight,
  Database, Download, Layers, Loader2, Package, Upload, Wrench,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

/* ============================ PARTS LIST ============================= */

function PartRow({ bi }: { bi: any }) {
  const [open, setOpen] = useState(false)

  const details: [string, string][] = [
    ['Part number', bi.pn],
    ['Kit number', bi.kitNumber],
    ['Category', bi.cat],
    ['Quantity', bi.qty],
    ['UOM', bi.uom],
    ['Ref designator', bi.refDes || '—'],
    ['Date added', bi.addedAt],
  ]

  return (
    <>
      <tr
        className={open ? 'sel' : ''}
        style={{ cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
        data-test-id={`part-row-${bi.id}`}
      >
        <td style={{ width: 32, paddingRight: 0 }}>
          <span style={{ color: T.g400, display: 'inline-flex', alignItems: 'center' }}>
            {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </span>
        </td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <span className="pn">{bi.pn}</span>
        </td>
        <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bi.name}>
          {bi.name}
        </td>
        <td className="sub">{bi.cat}</td>
        <td>{bi.qty}</td>
        <td className="sub">{bi.uom}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <span className="pn" style={{ color: T.g700 }}>{bi.kitNumber}</span>
        </td>
        <td className="sub">{bi.addedAt}</td>
      </tr>
      {open && (
        <tr data-test-id={`part-detail-${bi.id}`}>
          <td colSpan={8} style={{ padding: 0, background: '#F8FAFC', borderBottom: `1px solid ${T.g100}` }}>
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
              {bi.notes && (
                <div style={{ gridColumn: '1 / -1', paddingRight: 16, marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.g500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</div>
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

function PartsList({ renderHeaderActions }: { renderHeaderActions?: () => React.ReactNode }) {
  const [q, setQ] = useState('')
  const [catFilter, setCatFilter] = useState('All')
  const [page, setPage] = useState(0)
  const [bulk, setBulk] = useState(false)

  const { bomItems, loading, error } = useAllBomItems()
  const { runExport, isPending: exporting } = useExportData()

  // Unique categories for filter pills
  const cats = useMemo(() => {
    const set = new Set(bomItems.map((b) => b.cat).filter(Boolean))
    return ['All', ...Array.from(set).sort()]
  }, [bomItems])

  const filtered = useMemo(() => bomItems.filter((b) => {
    const matchesCat = catFilter === 'All' || b.cat === catFilter
    const matchesQ = (b.pn + ' ' + b.name + ' ' + b.kitNumber).toLowerCase().includes(q.toLowerCase())
    return matchesCat && matchesQ
  }), [bomItems, q, catFilter])

  React.useEffect(() => { setPage(0) }, [q, catFilter])

  // KPI counts
  const uniqueParts = useMemo(() => new Set(bomItems.map((b) => b.pn)).size, [bomItems])
  const uniqueKits = useMemo(() => new Set(bomItems.map((b) => b.kitNumber)).size, [bomItems])
  const catCount = (cat: string) => cat === 'All' ? bomItems.length : bomItems.filter((b) => b.cat === cat).length

  return (
    <div className="stack" data-test-id="parts-list-page">
      {/* Header */}
      <div className="bet">
        <div>
          <div className="crumb">Items · Parts</div>
          <h1>Parts</h1>
          <div className="sub" style={{ marginTop: 4 }}>
            Component parts inside kits — {bomItems.length} BOM line items across {uniqueKits} kits
          </div>
        </div>
        <div className="row">
          <button
            className="btn"
            onClick={() => {
              const win = window.open('about:blank', '_blank')
              runExport('item', win)
            }}
            data-test-id="export-parts-btn"
            disabled={exporting}
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            {exporting ? 'Preparing…' : 'Export to Excel'}
          </button>
          <button className="btn" onClick={() => setBulk(true)} data-test-id="parts-bulk-upload-btn">
            <Upload size={13} />Bulk upload
          </button>
          {renderHeaderActions?.()}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid4" data-test-id="parts-kpis">
        <Kpi label="Total BOM lines" value={bomItems.length} icon={Layers} />
        <Kpi label="Unique parts" value={uniqueParts} icon={Package} />
        <Kpi label="Kits referenced" value={uniqueKits} icon={Wrench} />
        <Kpi label="Showing" value={filtered.length} icon={Database} />
      </div>

      {/* Toolbar */}
      <div className="toolbar" data-test-id="parts-toolbar">
        <div className="seg" data-test-id="parts-cat-seg" style={{ flexWrap: 'wrap' }}>
          {cats.map((c) => (
            <button
              key={c}
              type="button"
              className={catFilter === c ? 'on' : ''}
              onClick={() => setCatFilter(c)}
              data-test-id={`parts-cat-${c.toLowerCase().replace(/\s/g, '-')}`}
            >
              <span>{c}</span>
              <span className="n">{catCount(c)}</span>
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <input
            placeholder="Search part number, name or kit…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search parts"
            data-test-id="parts-search-input"
            style={{ height: 32, padding: '0 10px', borderRadius: 10, border: `1px solid ${T.g200}`, fontSize: 13, color: T.g900, background: '#fff', outline: 'none', width: 240 }}
          />
        </div>
      </div>

      {/* Table */}
      <Card pad={false} data-test-id="parts-table-card">
        <div className="scrollx">
          <table className="tbl" data-test-id="parts-table">
            <thead>
              <tr>
                <th style={{ width: 32 }} />
                <th>Part number</th>
                <th>Part name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>UOM</th>
                <th>Kit number</th>
                <th>Date added</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8}><Empty icon={Database} title="Loading parts…" body="Fetching BOM line items from backend." /></td></tr>
              )}
              {Boolean(error) && (
                <tr><td colSpan={8}><Empty icon={AlertTriangle} title="Failed to load parts" body="Check your connection and try refreshing." /></td></tr>
              )}
              {!loading && !error && filtered.length === 0 && (
                <tr><td colSpan={8}><Empty icon={Package} title="No parts match" body="Try a different search or category filter." /></td></tr>
              )}
              {!loading && !error && filtered
                .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                .map((bi) => <PartRow key={bi.id} bi={bi} />)
              }
            </tbody>
          </table>
        </div>
        <Pagination total={filtered.length} page={page} setPage={setPage} />
      </Card>

      {bulk && (
        <Modal
          title="Bulk upload parts"
          wide
          onClose={() => setBulk(false)}
          foot={
            <>
              <span className="sub">Upload BOM line items using the template below. Each row must reference an existing kit number.</span>
              <button className="btn" style={{ marginLeft: 'auto' }} onClick={() => setBulk(false)}>Close</button>
            </>
          }
        >
          <ImportPanel template={BOM_ITEM_TEMPLATE} templateName="topcon-parts-template.csv" entity="parts" />
        </Modal>
      )}
    </div>
  )
}

export { PartsList }
