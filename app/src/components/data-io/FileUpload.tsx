import { useKitFilesByPn, useCreateKitFile, useDeleteKitFile, type KitFile } from '@/data/kitFiles'
import { Modal } from '@/components/primitives/Modal'
import { Select } from '@/components/primitives/Field'
import { T } from '@/theme/tokens'
import { useUppy } from '@unifyapps/app-builder-sdk/hooks/upload'
import { Check, ExternalLink, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import React, { useRef, useState } from 'react'
import { toast } from 'sonner'

const FILE_TYPES = ['Drawing', 'Work instruction', 'Inspection report', 'Specification', 'Certificate', 'Other'] as const
const VISIBILITY_OPTS = ['Internal only', 'Share with suppliers'] as const

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type StagedMeta = { fileType: string; visibility: string; isPrimary: boolean }

/* ─ FileUpload body ──────────────────────────────────────────────────── */
function FileUpload({
  onClose,
  context,
  hideCancel,
  itemPn,
}: {
  onClose: () => void
  context?: string
  hideCancel?: boolean
  itemPn?: string
}) {
  const [stagedMeta, setStagedMeta] = useState<Record<string, StagedMeta>>({})
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { files, isUploading, addFiles, removeFile } = useUppy({
    referenceId: itemPn ? `kit-file-${itemPn}` : undefined,
    accessScope: 'PUBLIC',
    maxFileSize: 100 * 1024 * 1024,
    allowedFileTypes: ['.pdf', '.dwg', '.step', '.stp', '.docx', '.doc', '.xlsx', '.xls', '.png', '.jpg', '.jpeg', '.svg'],
  })

  const { files: savedFiles, loading: savedLoading } = useKitFilesByPn(itemPn ?? '')
  const createKitFile = useCreateKitFile()
  const deleteKitFile = useDeleteKitFile()

  const handleFilesInput = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const results = await addFiles(fileList)
    results.forEach((f) => {
      if (f.status !== 'error') {
        setStagedMeta((prev) => ({
          ...prev,
          [f.id]: { fileType: 'Drawing', visibility: 'Internal only', isPrimary: false },
        }))
      } else {
        toast.error(`${f.name}: ${f.error ?? 'Upload failed'}`)
      }
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFilesInput(e.dataTransfer.files)
  }

  const updateMeta = (fileId: string, patch: Partial<StagedMeta>) =>
    setStagedMeta((prev) => ({ ...prev, [fileId]: { ...(prev[fileId] ?? { fileType: 'Drawing', visibility: 'Internal only', isPrimary: false }), ...patch } }))

  const handleAttach = async () => {
    if (!itemPn) {
      toast.error('No item selected')
      return
    }
    const readyFiles = files.filter((f) => f.status === 'success' && f.url)
    if (readyFiles.length === 0) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      for (const f of readyFiles) {
        const meta = stagedMeta[f.id] ?? { fileType: 'Drawing', visibility: 'Internal only', isPrimary: false }
        await createKitFile({
          itemPn,
          fileName: f.name,
          fileType: meta.fileType,
          visibility: meta.visibility,
          isPrimary: meta.isPrimary,
          url: f.url!,
          size: fmtSize(f.size),
          mimeType: f.type,
          uploadedAt: now,
        })
      }
      toast.success(`${readyFiles.length} file${readyFiles.length === 1 ? '' : 's'} attached`)
      setStagedMeta({})
      onClose()
    } catch {
      toast.error('Failed to save file records')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSaved = async (file: KitFile) => {
    try {
      await deleteKitFile(file.id)
      toast.success(`${file.fileName} removed`)
    } catch {
      toast.error('Failed to remove file')
    }
  }

  const uploadingOrSaving = isUploading || saving
  const readyCount = files.filter((f) => f.status === 'success').length

  return (
    <div className="stack" data-test-id="file-upload-body">

      {/* Already-saved files */}
      {itemPn && (savedLoading ? (
        <div className="row" style={{ gap: 8, color: T.g500, fontSize: 13 }} data-test-id="kit-files-loading">
          <Loader2 size={14} className="animate-spin" /> Loading existing files&hellip;
        </div>
      ) : savedFiles.length > 0 ? (
        <div className="card" style={{ overflow: 'hidden' }} data-test-id="kit-saved-files-table">
          <div style={{ padding: '10px 16px 6px', fontWeight: 600, fontSize: 12, color: T.g600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Attached files
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>File</th>
                <th>Type</th>
                <th>Visibility</th>
                <th style={{ width: 80 }}>Size</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {savedFiles.map((f) => (
                <tr key={f.id} data-test-id={`saved-file-row-${f.id}`}>
                  <td>
                    <div className="row" style={{ gap: 9 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: T.b50, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <FileText size={14} color={T.brand} />
                      </span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{f.fileName}</div>
                        {f.isPrimary && <span className="chip c-blue" style={{ fontSize: 10, padding: '1px 6px' }}>Primary</span>}
                      </div>
                    </div>
                  </td>
                  <td className="sub">{f.fileType}</td>
                  <td className="sub">{f.visibility}</td>
                  <td className="sub">{f.size}</td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                      {f.url && (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn gh sm"
                          aria-label={`Open ${f.fileName}`}
                          data-test-id={`open-saved-file-${f.id}`}
                        >
                          <ExternalLink size={12} />
                        </a>
                      )}
                      <button
                        type="button"
                        className="btn gh sm"
                        onClick={() => handleDeleteSaved(f)}
                        aria-label={`Delete ${f.fileName}`}
                        data-test-id={`delete-saved-file-${f.id}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null)}

      {/* Drop zone */}
      <button
        type="button"
        className="drop"
        data-test-id="file-upload-dropzone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        aria-label="Upload files"
        disabled={uploadingOrSaving}
      >
        <span style={{ width: 44, height: 44, borderRadius: 12, background: T.b50, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
          <Upload size={20} color={T.brand} />
        </span>
        <div style={{ fontWeight: 600, marginTop: 11 }}>Drop files here, or click to choose</div>
        <div className="sub" style={{ marginTop: 4 }}>PDF, DWG, STEP, Office documents and images &middot; up to 100 MB each</div>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.dwg,.step,.stp,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.svg"
        style={{ display: 'none' }}
        aria-hidden="true"
        onChange={(e) => handleFilesInput(e.target.files)}
        data-test-id="file-upload-input"
      />

      {/* Staged (uploading / uploaded) files */}
      {files.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }} data-test-id="file-upload-staged-table">
          <div style={{ padding: '10px 16px 6px', fontWeight: 600, fontSize: 12, color: T.g600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            New files
          </div>
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
              {files.map((f, k) => {
                const meta = stagedMeta[f.id] ?? { fileType: 'Drawing', visibility: 'Internal only', isPrimary: false }
                return (
                  <tr key={f.id} data-test-id={`staged-file-row-${f.id}`}>
                    <td>
                      <div className="row" style={{ gap: 9 }}>
                        <span style={{ width: 28, height: 28, borderRadius: 8, background: T.b50, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          {f.status === 'uploading'
                            ? <Loader2 size={13} color={T.brand} className="animate-spin" />
                            : f.status === 'error'
                            ? <FileText size={14} color={T.bad} />
                            : <FileText size={14} color={T.brand} />}
                        </span>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                          <div className="mini">
                            {f.status === 'uploading' ? `${f.progress}%` : f.status === 'error' ? (f.error ?? 'Error') : fmtSize(f.size)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Select
                        style={{ height: 28 }}
                        value={meta.fileType}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateMeta(f.id, { fileType: e.target.value })}
                        options={FILE_TYPES}
                        aria-label="File type"
                        data-test-id={`staged-file-type-${f.id}`}
                      />
                    </td>
                    <td>
                      <Select
                        style={{ height: 28 }}
                        value={meta.visibility}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateMeta(f.id, { visibility: e.target.value })}
                        options={VISIBILITY_OPTS}
                        aria-label="Visibility"
                        data-test-id={`staged-file-visibility-${f.id}`}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="radio"
                        name="file-primary"
                        checked={meta.isPrimary}
                        onChange={() => {
                          setStagedMeta((prev) => {
                            const next: Record<string, StagedMeta> = {}
                            Object.entries(prev).forEach(([id, m]) => { next[id] = { ...m, isPrimary: false } })
                            next[f.id] = { ...(next[f.id] ?? meta), isPrimary: true }
                            return next
                          })
                        }}
                        aria-label={`Set ${f.name} as primary`}
                        data-test-id={`staged-file-primary-${f.id}`}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn gh sm"
                        onClick={() => {
                          removeFile(f.id)
                          setStagedMeta((prev) => { const n = { ...prev }; delete n[f.id]; return n })
                        }}
                        aria-label={`Remove ${f.name}`}
                        data-test-id={`remove-file-btn-${k}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="note" data-test-id="file-upload-note">
        Files attached to {context ?? 'this record'} are versioned. Replacing one keeps the previous version in history.
      </div>

      <div className="bet" data-test-id="file-upload-actions">
        {!hideCancel && (
          <button type="button" className="btn" onClick={onClose} data-test-id="file-upload-cancel-btn">
            Cancel
          </button>
        )}
        <button
          type="button"
          className="btn pri"
          disabled={readyCount === 0 || uploadingOrSaving}
          onClick={handleAttach}
          data-test-id="file-upload-attach-btn"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Saving\u2026' : isUploading ? 'Uploading\u2026' : `Attach ${readyCount > 0 ? readyCount : ''} file${readyCount === 1 ? '' : 's'}`}
        </button>
      </div>
    </div>
  )
}

/* ─ FileUploadModal ──────────────────────────────────────────────────── */
function FileUploadModal({
  open,
  onClose,
  context,
  itemPn,
}: {
  open: boolean
  onClose: () => void
  context?: string
  itemPn?: string
}) {
  if (!open) return null
  return (
    <Modal title="Attach files" wide onClose={onClose}>
      <FileUpload onClose={onClose} context={context} itemPn={itemPn} />
    </Modal>
  )
}

// Legacy type alias kept for backward-compatible imports
type StagedFile = { n: string; size: string; fileType: string; visibility: string }

export { FileUpload, FileUploadModal }
export type { StagedFile }
