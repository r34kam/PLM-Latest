/**
 * ImportPanel — real Excel/CSV parse → validate → dedup → preview → backend write.
 *
 * Props:
 *   template      CSV string for the downloadable template
 *   templateName  filename for the template download
 *   entity        display noun e.g. "items" or "parts"
 *   columns       column config array (see ColumnDef below)
 *   existingKeys  Set of existing primary keys (for duplicate detection)
 *   onConfirm     async (rows) => void — called with the validated+selected rows to write
 */
import { Kpi } from '@/components/primitives/Kpi'
import { downloadFile } from '@/lib/download'
import { T } from '@/theme/tokens'
import {
  AlertTriangle, Ban, Check, CheckCircle2, Download,
  FileSpreadsheet, Loader2, Trash2, Upload, X,
} from 'lucide-react'
import { useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Sev = 'ok' | 'warn' | 'err'

type ParsedRow = {
  _key: string          // primary key field value (for dedup)
  _sev: Sev
  _rule: string
  _msg: string
  [field: string]: unknown
}

type ColumnDef = {
  header: string        // Excel column header (case-insensitive match)
  field: string         // output field name
  required?: boolean
}

type ImportPanelProps = {
  template: string
  templateName: string
  entity?: string
  columns: ColumnDef[]
  primaryKey: string    // which `field` is the unique key for dedup
  existingKeys: Set<string>
  onConfirm: (rows: Record<string, unknown>[]) => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sev(rule: string, msg: string, s: Sev): Pick<ParsedRow, '_sev' | '_rule' | '_msg'> {
  return { _sev: s, _rule: rule, _msg: msg }
}

function sevChip(s: Sev) {
  if (s === 'ok') return { bg: T.okBg, color: T.ok, icon: Check }
  if (s === 'warn') return { bg: T.warnBg, color: T.warn, icon: AlertTriangle }
  return { bg: T.badBg, color: T.bad, icon: X }
}

/** Parse an Excel/CSV file into rows of { header → value } objects. */
async function parseFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import('xlsx')
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
  // Normalise header keys to lowercase-trimmed
  return raw.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? '').trim()]))
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

function ImportPanel({
  template, templateName, entity = 'items',
  columns, primaryKey, existingKeys, onConfirm,
}: ImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [rows, setRows] = useState<ParsedRow[] | null>(null)
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const [saveError, setSaveError] = useState<string | null>(null)

  function reset() {
    setFileName(null); setRows(null); setSkipped(new Set())
    setSavedCount(0); setSaveError(null); setParsing(false)
  }

  async function handleFile(file: File) {
    setFileName(file.name)
    setParsing(true)
    setRows(null)
    setSkipped(new Set())
    setSavedCount(0)
    setSaveError(null)
    try {
      const rawRows = await parseFile(file)
      const pkField = columns.find((c) => c.field === primaryKey)
      const pkHeader = pkField?.header.toLowerCase() ?? primaryKey.toLowerCase()

      const parsed: ParsedRow[] = rawRows.map((raw, idx) => {
        // Map headers → fields
        const mapped: Record<string, unknown> = {}
        for (const col of columns) {
          const val = raw[col.header.toLowerCase()] ?? ''
          mapped[col.field] = val
        }

        const key = String(mapped[primaryKey] ?? '').trim()
        const rowLabel = `Row ${idx + 2}`

        // Required field check
        const missingRequired = columns.filter(
          (c) => c.required && !String(mapped[c.field] ?? '').trim()
        )
        if (missingRequired.length) {
          return {
            ...mapped, _key: key || rowLabel,
            ...sev('Missing required', `${missingRequired.map((c) => c.header).join(', ')} must not be empty`, 'err'),
          }
        }

        // Empty primary key
        if (!key) {
          return {
            ...mapped, _key: rowLabel,
            ...sev('Missing key', `"${pkField?.header ?? primaryKey}" is required`, 'err'),
          }
        }

        // Duplicate within this file
        const dupInFile = rawRows
          .slice(0, idx)
          .some((r) => String(r[pkHeader] ?? '').trim().toLowerCase() === key.toLowerCase())
        if (dupInFile) {
          return {
            ...mapped, _key: key,
            ...sev('Duplicate in file', `"${key}" appears more than once in this upload`, 'err'),
          }
        }

        // Already exists in the backend
        if (existingKeys.has(key.toLowerCase())) {
          return {
            ...mapped, _key: key,
            ...sev('Already exists', `"${key}" is already in the system — importing will be skipped`, 'warn'),
          }
        }

        return { ...mapped, _key: key, ...sev('Ready', 'All checks passed', 'ok') }
      })

      setRows(parsed)
    } catch (e: any) {
      setRows([])
    } finally {
      setParsing(false)
    }
  }

  function toggleSkip(key: string) {
    setSkipped((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  async function handleConfirm() {
    if (!rows) return
    const toAdd = rows.filter((r) => r._sev !== 'err' && !skipped.has(r._key))
    setSaving(true)
    setSaveError(null)
    try {
      const clean = toAdd.map((r) => {
        const out: Record<string, unknown> = {}
        for (const col of columns) out[col.field] = r[col.field] ?? ''
        return out
      })
      await onConfirm(clean)
      setSavedCount(toAdd.length)
    } catch (e: any) {
      setSaveError(e?.message ?? 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (savedCount > 0) return (
    <div className="stack" data-test-id="import-success">
      <div className="okbox">
        <CheckCircle2 size={15} />
        <div>
          <b>{savedCount} {entity} added successfully.</b>
          {rows && (rows.filter((r) => r._sev === 'err').length > 0 || skipped.size > 0) && (
            <span> {rows.filter((r) => r._sev === 'err').length} blocked and {skipped.size} skipped rows were left out.</span>
          )}
        </div>
      </div>
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={reset} data-test-id="import-upload-another">
        <Upload size={13} />Upload another file
      </button>
    </div>
  )

  // ── Drop zone ──────────────────────────────────────────────────────────────
  if (!fileName) return (
    <div className="stack" data-test-id="import-dropzone-section">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        aria-label={`Upload ${entity} file`}
        data-test-id="import-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <button
        className="drop"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) handleFile(f)
        }}
        data-test-id="import-drop-area"
      >
        <span style={{ width: 44, height: 44, borderRadius: 12, background: T.b50, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
          <Upload size={20} color={T.brand} />
        </span>
        <div style={{ fontWeight: 600, marginTop: 11 }}>Drop an Excel or CSV file, or choose a file</div>
        <div className="sub" style={{ marginTop: 4 }}>One row per {entity.replace(/s$/, '')} · up to 5,000 rows</div>
      </button>
      <div className="bet">
        <span className="sub">Every row is validated before anything is written.</span>
        <button className="btn" onClick={() => downloadFile(templateName, template)} data-test-id="import-download-template">
          <Download size={13} />Download template
        </button>
      </div>
    </div>
  )

  // ── Parsing spinner ────────────────────────────────────────────────────────
  if (parsing) return (
    <div className="stack" style={{ alignItems: 'center', padding: '32px 0' }} data-test-id="import-parsing">
      <Loader2 size={28} className="animate-spin" style={{ color: T.brand }} />
      <div style={{ fontWeight: 600, marginTop: 12 }}>Reading {fileName}…</div>
      <div className="sub">Parsing rows and running checks</div>
    </div>
  )

  // ── Preview table ──────────────────────────────────────────────────────────
  if (!rows || rows.length === 0) return (
    <div className="stack" data-test-id="import-empty">
      <div className="bet">
        <div className="row">
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.warnBg, display: 'grid', placeItems: 'center' }}>
            <AlertTriangle size={16} color={T.warn} />
          </span>
          <div><b>{fileName}</b><div className="mini">No rows found — check your file matches the template</div></div>
        </div>
        <button className="btn gh sm" onClick={reset} data-test-id="import-remove-file"><Trash2 size={12} />Remove file</button>
      </div>
      <div className="bet">
        <span className="sub">Download the template to see the required column headers.</span>
        <button className="btn" onClick={() => downloadFile(templateName, template)} data-test-id="import-dl-tpl-empty">
          <Download size={13} />Download template
        </button>
      </div>
    </div>
  )

  const okRows = rows.filter((r) => r._sev === 'ok')
  const warnRows = rows.filter((r) => r._sev === 'warn')
  const errRows = rows.filter((r) => r._sev === 'err')
  const toAdd = rows.filter((r) => r._sev !== 'err' && !skipped.has(r._key))
  const displayOrder = [...warnRows, ...okRows, ...errRows]
  // Primary display columns (first 3 non-key fields after the key)
  const previewCols = columns.slice(0, 5)

  return (
    <div className="stack" data-test-id="import-preview-section">
      {/* File header */}
      <div className="bet">
        <div className="row">
          <span style={{ width: 34, height: 34, borderRadius: 9, background: T.okBg, display: 'grid', placeItems: 'center' }}>
            <FileSpreadsheet size={16} color={T.ok} />
          </span>
          <div>
            <b>{fileName}</b>
            <div className="mini">{rows.length} rows read</div>
          </div>
        </div>
        <button className="btn gh sm" onClick={reset} data-test-id="import-remove-file"><Trash2 size={12} />Remove file</button>
      </div>

      {/* KPIs */}
      <div className="grid3" data-test-id="import-kpis">
        <Kpi label="Ready to add" value={okRows.length} icon={Check} />
        <Kpi label="Needs a decision" value={warnRows.length} icon={AlertTriangle} tint={T.warnBg} bd={T.warnBd} tone={T.warn} />
        <Kpi label="Blocked" value={errRows.length} icon={X} tint={T.badBg} bd={T.badBd} tone={T.bad} />
      </div>

      {/* Preview table */}
      <div className="card" style={{ overflow: 'auto', maxHeight: 400 }} data-test-id="import-preview-table">
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 34 }}>Add</th>
              {previewCols.map((c) => <th key={c.field}>{c.header}</th>)}
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {displayOrder.map((r) => {
              const blocked = r._sev === 'err'
              const checked = !blocked && !skipped.has(r._key)
              const chip = sevChip(r._sev)
              const Icon = chip.icon
              return (
                <tr
                  key={r._key}
                  style={blocked ? { opacity: 0.55 } : undefined}
                  data-test-id={`import-row-${r._key}`}
                >
                  <td>
                    {blocked
                      ? <Ban size={13} color={T.g400} />
                      : (
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Include ${r._key}`}
                          onChange={() => toggleSkip(r._key)}
                        />
                      )
                    }
                  </td>
                  {previewCols.map((c) => (
                    <td key={c.field} className={c.field === primaryKey ? 'pn' : ''}>
                      {String(r[c.field] ?? '')}
                    </td>
                  ))}
                  <td>
                    <span
                      className="row"
                      style={{
                        gap: 5, background: chip.bg, color: chip.color,
                        padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        display: 'inline-flex', whiteSpace: 'nowrap',
                      }}
                    >
                      <Icon size={11} />
                      {r._rule}
                    </span>
                  </td>
                  <td className="sub" style={{ maxWidth: 320 }}>{r._msg}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {saveError && (
        <div
          className="row"
          style={{ gap: 8, background: T.badBg, color: T.bad, padding: '10px 14px', borderRadius: 10, fontSize: 13 }}
          data-test-id="import-save-error"
        >
          <AlertTriangle size={14} />{saveError}
        </div>
      )}

      {/* Action bar */}
      <div className="bet" data-test-id="import-action-bar">
        <div className="row" style={{ gap: 8 }}>
          {warnRows.length > 0 && (
            <>
              <button
                className="btn sm"
                onClick={() => setSkipped(new Set(warnRows.map((r) => r._key)))}
                data-test-id="import-skip-all-warnings"
              >
                Skip all warnings
              </button>
              <button
                className="btn sm"
                onClick={() => setSkipped(new Set())}
                data-test-id="import-include-all-warnings"
              >
                Include all
              </button>
            </>
          )}
          <button
            className="btn sm"
            onClick={() => downloadFile(
              'import-issues.csv',
              'Key,Status,Detail\n' + [...warnRows, ...errRows]
                .map((r) => `"${r._key}","${r._rule}","${r._msg}"`)
                .join('\n')
            )}
            data-test-id="import-issue-report"
          >
            <Download size={12} />Issue report
          </button>
        </div>
        <button
          className="btn pri"
          disabled={toAdd.length === 0 || saving}
          onClick={handleConfirm}
          data-test-id="import-confirm-btn"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Saving…' : `Add ${toAdd.length} ${entity}`}
        </button>
      </div>
    </div>
  )
}

export { ImportPanel }
export type { ColumnDef, ImportPanelProps }


