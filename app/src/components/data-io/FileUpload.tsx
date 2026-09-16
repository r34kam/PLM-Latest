import { useKitFilesByPn, useCreateKitFile, useDeleteKitFile, type KitFile } from "@/data/kitFiles"
import { useEcoFilesByCoId, useCreateEcoFile, useDeleteEcoFile, type EcoFile } from "@/data/ecoFiles"
import { Modal } from "@/components/primitives/Modal"
import { Select } from "@/components/primitives/Field"
import { cn } from "@/lib/utils"
import { useUppy } from "@unifyapps/app-builder-sdk/hooks/upload"
import { Check, ExternalLink, Loader2, ShieldCheck, Trash2, UploadCloud, X } from "lucide-react"
import React, { useRef, useState } from "react"
import { toast } from "sonner"

const FILE_TYPES = ["Drawing", "Work instruction", "Inspection report", "Specification", "Certificate", "Reference", "Other"] as const
const VISIBILITY_OPTS = ["Internal only", "Share with suppliers"] as const

function fmtSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B"
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB"
  return (bytes / (1024 * 1024)).toFixed(1) + " MB"
}

function fileExt(name: string): string {
  return (name.split(".").pop() ?? "").toUpperCase().slice(0, 4)
}

type StagedMeta = { fileType: string; visibility: string; isPrimary: boolean }

function FileIcon({ name, uploading, error }: { name: string; uploading?: boolean; error?: boolean }) {
  const ext = fileExt(name)
  return (
    <span
      className={cn(
        "flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[9px] font-bold tracking-wide",
        error ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
      )}
      aria-hidden="true"
      data-test-id="file-icon"
    >
      {uploading ? <Loader2 size={14} className="animate-spin" /> : (ext || "—")}
    </span>
  )
}

function FileUpload({
  onClose,
  context,
  hideCancel,
  itemPn,
  coId,
  uploadedBy,
}: {
  onClose: () => void
  context?: string
  hideCancel?: boolean
  itemPn?: string
  coId?: string
  uploadedBy?: string
}) {
  const [stagedMeta, setStagedMeta] = useState<Record<string, StagedMeta>>({})
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const referenceId = itemPn ? "kit-file-" + itemPn : coId ? "eco-file-" + coId : undefined

  const { files, isUploading, addFiles, removeFile } = useUppy({
    referenceId,
    accessScope: "PUBLIC",
    maxFileSize: 100 * 1024 * 1024,
    allowedFileTypes: [".pdf", ".dwg", ".step", ".stp", ".docx", ".doc", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ".svg"],
  })

  const { files: kitSavedFiles, loading: kitLoading } = useKitFilesByPn(itemPn ?? "")
  const createKitFile = useCreateKitFile()
  const deleteKitFile = useDeleteKitFile()

  const { files: ecoSavedFiles, loading: ecoLoading } = useEcoFilesByCoId(coId ?? "")
  const createEcoFile = useCreateEcoFile()
  const deleteEcoFile = useDeleteEcoFile()

  type SavedFile = { id: string; fileName: string; fileType: string; visibility: string; isPrimary: boolean; url: string; size: string }
  const savedFiles: SavedFile[] = itemPn
    ? kitSavedFiles.map((f: KitFile) => ({ id: f.id, fileName: f.fileName, fileType: f.fileType, visibility: f.visibility, isPrimary: f.isPrimary, url: f.url, size: f.size }))
    : ecoSavedFiles.map((f: EcoFile) => ({ id: f.id, fileName: f.fileName, fileType: f.fileType, visibility: f.visibility, isPrimary: f.isPrimary, url: f.url, size: f.size }))
  const savedLoading = itemPn ? kitLoading : ecoLoading

  const handleFilesInput = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const results = await addFiles(fileList)
    results.forEach((f) => {
      if (f.status !== "error") {
        setStagedMeta((prev) => ({ ...prev, [f.id]: { fileType: "Drawing", visibility: "Internal only", isPrimary: false } }))
      } else {
        toast.error(f.name + ": " + (f.error ?? "Upload failed"))
      }
    })
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFilesInput(e.dataTransfer.files)
  }

  const updateMeta = (fileId: string, patch: Partial<StagedMeta>) =>
    setStagedMeta((prev) => ({ ...prev, [fileId]: { ...(prev[fileId] ?? { fileType: "Drawing", visibility: "Internal only", isPrimary: false }), ...patch } }))

  const handleAttach = async () => {
    if (!itemPn && !coId) { toast.error("No record selected"); return }
    const readyFiles = files.filter((f) => f.status === "success" && f.url)
    if (readyFiles.length === 0) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      for (const f of readyFiles) {
        const meta = stagedMeta[f.id] ?? { fileType: "Drawing", visibility: "Internal only", isPrimary: false }
        if (itemPn) {
          await createKitFile({ itemPn, fileName: f.name, fileType: meta.fileType, visibility: meta.visibility, isPrimary: meta.isPrimary, url: f.url!, size: fmtSize(f.size), mimeType: f.type, uploadedAt: now })
        } else if (coId) {
          await createEcoFile({ coId, fileName: f.name, fileType: meta.fileType, visibility: meta.visibility, isPrimary: meta.isPrimary, url: f.url!, size: fmtSize(f.size), mimeType: f.type, uploadedAt: now, uploadedBy: uploadedBy ?? "" })
        }
      }
      toast.success(readyFiles.length + " file" + (readyFiles.length === 1 ? "" : "s") + " attached")
      setStagedMeta({})
      onClose()
    } catch {
      toast.error("Failed to save file records")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSaved = async (file: { id: string; fileName: string }) => {
    try {
      if (itemPn) await deleteKitFile(file.id)
      else await deleteEcoFile(file.id)
      toast.success(file.fileName + " removed")
    } catch {
      toast.error("Failed to remove file")
    }
  }

  const uploadingOrSaving = isUploading || saving
  const readyCount = files.filter((f) => f.status === "success").length

  return (
    <div className="flex flex-col gap-5" data-test-id="file-upload-body">
      <button
        type="button"
        data-test-id="file-upload-dropzone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        aria-label="Upload files"
        disabled={uploadingOrSaving}
        className={cn(
          "w-full flex flex-col items-center gap-2 py-8 px-6 rounded-xl border-2 border-dashed transition-colors cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:border-primary/40 hover:bg-muted/70"
        )}
      >
        <span className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <UploadCloud size={22} className="text-primary" />
        </span>
        <div className="text-sm font-semibold text-foreground mt-1">Drop files here, or click to choose</div>
        <div className="text-xs text-muted-foreground">PDF, DWG, STEP, Office documents and images · up to 100 MB each</div>
      </button>

      <input ref={inputRef} type="file" multiple accept=".pdf,.dwg,.step,.stp,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.svg" className="hidden" aria-hidden="true" onChange={(e) => handleFilesInput(e.target.files)} data-test-id="file-upload-input" />

      {files.length > 0 && (
        <div className="flex flex-col gap-2" data-test-id="file-upload-staged-table">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ready to attach</span>
            <span className="text-xs text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {files.map((f, k) => {
              const meta = stagedMeta[f.id] ?? { fileType: "Drawing", visibility: "Internal only", isPrimary: false }
              const isErr = f.status === "error"
              const isUp = f.status === "uploading"
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-card" data-test-id={"staged-file-row-" + f.id}>
                  <FileIcon name={f.name} uploading={isUp} error={isErr} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{f.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isUp ? "Uploading " + (f.progress ?? 0) + "%" : isErr ? (f.error ?? "Upload error") : fmtSize(f.size)}
                    </div>
                    {isUp && (
                      <div className="h-1 mt-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: (f.progress ?? 0) + "%" }} data-test-id={"staged-file-progress-" + f.id} />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Select value={meta.fileType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateMeta(f.id, { fileType: e.target.value })} options={FILE_TYPES} aria-label="File type" data-test-id={"staged-file-type-" + f.id} style={{ height: 30, fontSize: 12, minWidth: 130 }} />
                    <Select value={meta.visibility} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateMeta(f.id, { visibility: e.target.value })} options={VISIBILITY_OPTS} aria-label="Visibility" data-test-id={"staged-file-visibility-" + f.id} style={{ height: 30, fontSize: 12, minWidth: 130 }} />
                    <label className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors select-none", meta.isPrimary ? "border-primary bg-primary/10 text-primary font-semibold" : "border-border text-muted-foreground hover:border-primary/50")} title="Set as primary file" data-test-id={"staged-file-primary-label-" + f.id}>
                      <input type="radio" name="file-primary" className="sr-only" checked={meta.isPrimary} onChange={() => { setStagedMeta((prev) => { const next: Record<string, StagedMeta> = {}; Object.entries(prev).forEach(([id, m]) => { next[id] = { ...m, isPrimary: false } }); next[f.id] = { ...(next[f.id] ?? meta), isPrimary: true }; return next }) }} aria-label={"Set " + f.name + " as primary"} data-test-id={"staged-file-primary-" + f.id} />
                      Primary
                    </label>
                    <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => { removeFile(f.id); setStagedMeta((prev) => { const n = { ...prev }; delete n[f.id]; return n }) }} aria-label={"Remove " + f.name} data-test-id={"remove-file-btn-" + k}>
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {(savedLoading || savedFiles.length > 0) && (
        <div className="flex flex-col gap-2" data-test-id="kit-saved-files-table">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Attached files</span>
            {savedLoading && <Loader2 size={13} className="animate-spin text-muted-foreground" data-test-id="kit-files-loading" />}
          </div>
          {savedFiles.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {savedFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3 bg-card" data-test-id={"saved-file-row-" + f.id}>
                  <FileIcon name={f.fileName} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{f.fileName}</span>
                      {f.isPrimary && <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Primary</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{f.fileType}</span>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck size={10} />{f.visibility}</span>
                      <span className="text-muted-foreground/40 text-xs">·</span>
                      <span className="text-xs text-muted-foreground">{f.size}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {f.url && (
                      <a href={f.url} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors" aria-label={"Open " + f.fileName} data-test-id={"open-saved-file-" + f.id}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                    <button type="button" className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => handleDeleteSaved(f)} aria-label={"Delete " + f.fileName} data-test-id={"delete-saved-file-" + f.id}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 pt-1 border-t border-border" data-test-id="file-upload-footer">
        <p className="text-xs text-muted-foreground" data-test-id="file-upload-note">
          Files attached to {context ?? "this record"} are versioned — replacing one keeps the previous version in history.
        </p>
        <div className="flex items-center justify-between" data-test-id="file-upload-actions">
          {!hideCancel ? (
            <button type="button" className="btn" onClick={onClose} data-test-id="file-upload-cancel-btn">Cancel</button>
          ) : <span />}
          <button type="button" className="btn pri" disabled={readyCount === 0 || uploadingOrSaving} onClick={handleAttach} data-test-id="file-upload-attach-btn">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {saving ? "Saving…" : isUploading ? "Uploading…" : "Attach " + (readyCount > 0 ? readyCount + " " : "") + "file" + (readyCount === 1 ? "" : "s")}
          </button>
        </div>
      </div>
    </div>
  )
}

function FileUploadModal({ open, onClose, context, itemPn, coId, uploadedBy }: { open: boolean; onClose: () => void; context?: string; itemPn?: string; coId?: string; uploadedBy?: string }) {
  if (!open) return null
  return (
    <Modal title="Attach files" wide onClose={onClose}>
      <FileUpload onClose={onClose} context={context} itemPn={itemPn} coId={coId} uploadedBy={uploadedBy} />
    </Modal>
  )
}

type StagedFile = { n: string; size: string; fileType: string; visibility: string }

export { FileUpload, FileUploadModal }
export type { StagedFile }
