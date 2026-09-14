import { Modal } from '@/components/primitives/Modal'
import { Select } from '@/components/primitives/Field'
import { T } from '@/theme/tokens'
import { Check, FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

type StagedFile = { n: string; size: string; fileType: string; visibility: string }

const FILE_TYPES = ['Drawing', 'Work instruction', 'Inspection report', 'Specification', 'Certificate', 'Other'] as const
const VISIBILITY_OPTS = ['Internal only', 'Share with suppliers'] as const

/** Format bytes into a human-readable string */
function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ── FileUpload body (used inside modal or inline) ───────────────────── */
function FileUpload({
  onClose,
  onAttach,
  context,
  hideCancel,
}: {
  onClose: () => void
  onAttach?: (files: StagedFile[]) => void
  context?: string
  hideCancel?: boolean
}) {
  const [staged, setStaged] = useState<StagedFile[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return
    const next: StagedFile[] = Array.from(fileList).map((f) => ({
      n: f.name,
      size: fmtSize(f.size),
      fileType: 'Drawing',
      visibility: 'Internal only',
    }))
    setStaged((prev) => [...prev, ...next])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  const handleAttach = () => {
    onAttach?.(staged)
    onClose()
  }

  const updateStaged = (idx: number, patch: Partial<StagedFile>) =>
    setStaged((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)))

  return (
    <div className="stack" data-test-id="file-upload-body">
      {/* Drop zone — also opens native file picker on click */}
      <button
        type="button"
        className="drop"
        data-test-id="file-upload-dropzone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        aria-label="Upload files"
      >
        <span style={{ width: 44, height: 44, borderRadius: 12, background: T.b50, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
          <Upload size={20} color={T.brand} />
        </span>
        <div style={{ fontWeight: 600, marginTop: 11 }}>Drop files here, or click to choose</div>
        <div className="sub" style={{ marginTop: 4 }}>PDF, DWG, STEP, Office documents and images · up to 100 MB each</div>
      </button>

      {/* Hidden native input — works on every device including mobile */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.dwg,.step,.stp,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.svg"
        style={{ display: 'none' }}
        aria-hidden="true"
        onChange={(e) => handleFiles(e.target.files)}
        data-test-id="file-upload-input"
      />

      {staged.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }} data-test-id="file-upload-staged-table">
          <table className="tbl">
            <thead>
              <tr>
                <th>File</th>
                <th style={{ width: 190 }}>File type</th>
                <th style={{ width: 150 }}>Visibility</th>
                <th style={{ width: 90 }}>Primary</th>
                <th style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {staged.map((f, k) => (
                <tr key={k} data-test-id={`staged-file-row-${k}`}>
                  <td>
                    <div className="row" style={{ gap: 9 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: T.b50, display: 'grid', placeItems: 'center' }}>
                        <FileText size={14} color={T.brand} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 600 }}>{f.n}</div>
                        <div className="mini">{f.size}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Select
                      style={{ height: 28 }}
                      value={f.fileType}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStaged(k, { fileType: e.target.value })}
                      options={FILE_TYPES}
                    />
                  </td>
                  <td>
                    <Select
                      style={{ height: 28 }}
                      value={f.visibility}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateStaged(k, { visibility: e.target.value })}
                      options={VISIBILITY_OPTS}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input type="radio" name="file-primary" defaultChecked={k === 0} aria-label={`Set ${f.n} as primary`} />
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn gh sm"
                      onClick={() => setStaged((prev) => prev.filter((_, j) => j !== k))}
                      aria-label={`Remove ${f.n}`}
                      data-test-id={`remove-file-btn-${k}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="note">
        Files attached to {context ?? 'this record'} are versioned. Replacing one keeps the previous version in history.
      </div>

      <div className="bet">
        {!hideCancel && (
          <button type="button" className="btn" onClick={onClose} data-test-id="file-upload-cancel-btn">
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn pri"
          disabled={staged.length === 0}
          onClick={handleAttach}
          data-test-id="file-upload-attach-btn"
        >
          <Check size={13} />
          Attach {staged.length > 0 ? staged.length : ''} file{staged.length === 1 ? '' : 's'}
        </button>
      </div>
    </div>
  )
}

/* ── FileUploadModal — one line to get a modal anywhere in the app ────── */
function FileUploadModal({
  open,
  onClose,
  onAttach,
  context,
}: {
  open: boolean
  onClose: () => void
  onAttach?: (files: StagedFile[]) => void
  context?: string
}) {
  if (!open) return null
  return (
    <Modal title="Attach files" wide onClose={onClose}>
      <FileUpload onClose={onClose} onAttach={onAttach} context={context} />
    </Modal>
  )
}

export { FileUpload, FileUploadModal }
export type { StagedFile }


