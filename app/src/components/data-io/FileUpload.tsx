import { useKitFilesByPn, useCreateKitFile, useDeleteKitFile, type KitFile } from "@/data/kitFiles"
import { useEcoFilesByCoId, useCreateEcoFile, useDeleteEcoFile, type EcoFile } from "@/data/ecoFiles"
import { Modal } from "@/components/primitives/Modal"
import { Select } from "@/components/primitives/Field"
import { cn } from "@/lib/utils"
import { useUppy } from "@unifyapps/app-builder-sdk/hooks/upload"
import { Check, Circle, ExternalLink, History, Loader2, Trash2, UploadCloud, X } from "lucide-react"

import React, { useRef, useState } from "react"
import { toast } from "sonner"
import { format } from "date-fns"

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

function fmtDate(iso: string | undefined): string {
  if (!iso) return ""
  try { return format(new Date(iso), "d MMM") } catch { return "" }
}

type StagedMeta = { fileType: string; visibility: string; isPrimary: boolean }

/** Dark rounded-square extension badge matching the reference */
function ExtBadge({ name, uploading, error }: { name: string; uploading?: boolean; error?: boolean }) {
  const ext = fileExt(name)
  return (
    <span
      className={cn(
        "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-[10px] font-bold tracking-wide select-none",
        error
          ? "bg-destructive/15 text-destructive"
          : "bg-muted text-foreground"
      )}
      aria-hidden="true"
      data-test-id="file-icon"
    >
      {uploading ? <Loader2 size={14} className="animate-spin text-primary" /> : (ext || "—")}
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

  type SavedFile = { id: string; fileName: string; fileType: string; visibility: string; isPrimary: boolean; url: string; size: string; uploadedAt?: string; version?: number }
  const savedFiles: SavedFile[] = itemPn
    ? kitSavedFiles.map((f: KitFile) => ({ id: f.id, fileName: f.fileName, fileType: f.fileType, visibility: f.visibility, isPrimary: f.isPrimary, url: f.url, size: f.size, uploadedAt: (f as any).uploadedAt }))
    : ecoSavedFiles.map((f: EcoFile) => ({ id: f.id, fileName: f.fileName, fileType: f.fileType, visibility: f.visibility, isPrimary: f.isPrimary, url: f.url, size: f.size, uploadedAt: (f as any).uploadedAt }))
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
      readyFiles.forEach((f) => removeFile(f.id))
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

  const discardAll = () => {
    files.forEach((f) => removeFile(f.id))
    setStagedMeta({})
  }

  const uploadingOrSaving = isUploading || saving
  const readyCount = files.filter((f) => f.status === "success").length

  return (
    <div className="flex flex-col gap-5" data-test-id="file-upload-body">

      {/* ── Drop zone ── horizontal layout like reference */}
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
          "w-full flex items-center gap-4 px-6 py-5 rounded-xl border transition-all cursor-pointer text-left",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-card hover:border-primary/60 hover:bg-muted/30"
        )}
      >
        <span className={cn(
          "flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
          dragOver ? "bg-primary/15" : "bg-muted"
        )}>
          <UploadCloud size={20} className={cn("transition-colors", dragOver ? "text-primary" : "text-muted-foreground")} />
        </span>
        <div>
          <div className="text-sm font-medium text-foreground">
            Drop files here, or{" "}
            <span className="text-primary font-semibold underline-offset-2 hover:underline">click to choose</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            PDF, DWG, STEP, Office documents and images · up to 100 MB each
          </div>
        </div>
      </button>

      <input ref={inputRef} type="file" multiple accept=".pdf,.dwg,.step,.stp,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.svg" className="hidden" aria-hidden="true" onChange={(e) => handleFilesInput(e.target.files)} data-test-id="file-upload-input" />

      {/* ── Staged (ready to attach) ── */}
      {files.length > 0 && (
        <div className="flex flex-col gap-2" data-test-id="file-upload-staged-table">
          {/* Section header row: label + count + Discard all + Attach button */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
              Ready to attach
            </span>
            <span className="text-[11px] text-muted-foreground">{files.length} file{files.length !== 1 ? "s" : ""}</span>
            <div className="flex-1" />
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={discardAll}
              data-test-id="file-upload-discard-all"
            >
              Discard all
            </button>
            <button
              type="button"
              className="btn pri sm"
              disabled={readyCount === 0 || uploadingOrSaving}
              onClick={handleAttach}
              data-test-id="file-upload-attach-btn"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {saving ? "Saving…" : isUploading ? "Uploading…" : `Attach ${readyCount > 0 ? readyCount + " " : ""}file${readyCount === 1 ? "" : "s"}`}
            </button>
          </div>

          {/* Staged file cards */}
          <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
            {files.map((f, k) => {
              const meta = stagedMeta[f.id] ?? { fileType: "Drawing", visibility: "Internal only", isPrimary: false }
              const isErr = f.status === "error"
              const isUp = f.status === "uploading"
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3.5 bg-card" data-test-id={"staged-file-row-" + f.id}>
                  <ExtBadge name={f.name} uploading={isUp} error={isErr} />

                  {/* Name + size + progress */}
                  <div className="w-44 flex-shrink-0 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{f.name}</div>
                    <div className={cn("text-xs mt-0.5", isErr ? "text-destructive" : isUp ? "text-primary" : "text-muted-foreground")}>
                      {isUp ? `Uploading ${f.progress ?? 0}%` : isErr ? (f.error ?? "Upload error") : fmtSize(f.size)}
                    </div>
                    {isUp && (
                      <div className="mt-1.5 relative h-1.5 rounded-full overflow-hidden" style={{ background: "color-mix(in srgb, var(--primary), transparent 85%)" }} data-test-id={"staged-file-progress-" + f.id}>
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
                          style={{ width: (f.progress ?? 0) + "%", background: "linear-gradient(90deg, var(--primary) 0%, color-mix(in srgb, var(--primary), #818cf8 60%) 100%)", boxShadow: "0 0 6px color-mix(in srgb, var(--primary), transparent 40%)" }} />
                        <div className="absolute inset-y-0 left-0 rounded-full pointer-events-none"
                          style={{ width: (f.progress ?? 0) + "%", background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite" }} />
                      </div>
                    )}
                  </div>

                  {/* Type + Visibility dropdowns */}
                  <Select value={meta.fileType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateMeta(f.id, { fileType: e.target.value })} options={FILE_TYPES} aria-label="File type" data-test-id={"staged-file-type-" + f.id} style={{ height: 28, fontSize: 12, width: 120 }} />
                  <Select value={meta.visibility} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateMeta(f.id, { visibility: e.target.value })} options={VISIBILITY_OPTS} aria-label="Visibility" data-test-id={"staged-file-visibility-" + f.id} style={{ height: 28, fontSize: 12, width: 120 }} />

                  {/* Set primary */}
                  <button
                    type="button"
                    className={cn("flex-shrink-0 px-3 h-8 rounded-lg border text-xs font-medium transition-colors",
                      meta.isPrimary
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                    onClick={() => setStagedMeta((prev) => {
                      const next: Record<string, StagedMeta> = {}
                      Object.entries(prev).forEach(([id, m]) => { next[id] = { ...m, isPrimary: false } })
                      next[f.id] = { ...(next[f.id] ?? meta), isPrimary: true }
                      return next
                    })}
                    aria-pressed={meta.isPrimary}
                    data-test-id={"staged-file-primary-label-" + f.id}
                  >
                    {meta.isPrimary ? "Primary ✓" : "Set primary"}
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => { removeFile(f.id); setStagedMeta((prev) => { const n = { ...prev }; delete n[f.id]; return n }) }}
                    aria-label={"Remove " + f.name}
                    data-test-id={"remove-file-btn-" + k}
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Attached files ── */}
      {(savedLoading || savedFiles.length > 0) && (
        <div className="flex flex-col gap-2" data-test-id="kit-saved-files-table">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Attached files</span>
            {savedFiles.length > 0 && (
              <span className="text-[11px] text-muted-foreground">{savedFiles.length} file{savedFiles.length !== 1 ? "s" : ""}</span>
            )}
            {savedLoading && <Loader2 size={12} className="animate-spin text-muted-foreground ml-1" data-test-id="kit-files-loading" />}
          </div>
          {savedFiles.length > 0 && (
            <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
              {savedFiles.map((f) => (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3.5 bg-card" data-test-id={"saved-file-row-" + f.id}>
                  <ExtBadge name={f.fileName} />
                  <div className="flex-1 min-w-0">
                    {/* Name + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{f.fileName}</span>
                      {f.isPrimary && (
                        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md border border-primary/40 bg-primary/10 text-primary tracking-wide">
                          Primary
                        </span>
                      )}
                    </div>
                    {/* Meta row */}
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span>{f.fileType}</span>
                      <span className="opacity-40">·</span>
                      <span className="flex items-center gap-1">
                        {f.visibility === "Share with suppliers"
                          ? <span className="text-amber-500 font-medium flex items-center gap-1"><Circle size={8} className="fill-amber-500 stroke-none" />Shared with suppliers</span>
                          : <span className="flex items-center gap-1"><Circle size={8} className="opacity-40" />Internal only</span>
                        }
                      </span>
                      {f.size && <><span className="opacity-40">·</span><span>{f.size}</span></>}
                      {f.uploadedAt && <><span className="opacity-40">·</span><span>Updated {fmtDate(f.uploadedAt)}</span></>}
                    </div>
                  </div>
                  {/* Action icons */}
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {f.url && (
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                        aria-label={"Open " + f.fileName}
                        data-test-id={"open-saved-file-" + f.id}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={() => handleDeleteSaved(f)}
                      aria-label={"Delete " + f.fileName}
                      data-test-id={"delete-saved-file-" + f.id}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Footer note ── */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground" data-test-id="file-upload-footer">
        <History size={13} className="flex-shrink-0 mt-0.5 opacity-60" />
        <span>Files attached to {context ?? "this record"} are versioned — replacing one keeps the previous version in history.</span>
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
