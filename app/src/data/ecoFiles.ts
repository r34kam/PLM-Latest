/**
 * EcoFile data layer — reads and writes for files attached to Change Order records.
 * Each EcoFile links to its parent change order via the `coId` field.
 * Components import from '@/data', never calling SDK hooks directly.
 *
 * Upload flow: caller uses useUppy() to upload the file to UnifyApps storage,
 * then calls useCreateEcoFile() with the returned url. Never pass a blob: URL.
 */
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY, CREATE, DELETE } from './bindings'

const ECO_FILE = ENTITY.ecoFile
const EXECUTE_NODE_QK = '/api/workflow/execute/node'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type EcoFile = {
  id: string
  coId: string          // parent change order ID, e.g. "ECO-000051"
  fileName: string      // original file name shown in UI
  fileType: string      // Drawing | Work instruction | Inspection report | Specification | Certificate | Reference | Other
  visibility: string    // Internal only | Share with suppliers
  isPrimary: boolean    // is this the primary reference file?
  url: string           // UnifyApps storage URL — persisted value from useUppy
  size: string          // human-readable size, e.g. "1.2 MB"
  mimeType: string      // MIME type
  uploadedAt: string    // ISO date string
  uploadedBy: string    // display name of uploader
}

export type NewEcoFile = Omit<EcoFile, 'id'>

// ─── Flatten helper ──────────────────────────────────────────────────────────────

function flattenEcoFile(raw: any): EcoFile {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    coId: p.coId ?? '',
    fileName: p.fileName ?? '',
    fileType: p.fileType ?? 'Reference',
    visibility: p.visibility ?? 'Internal only',
    isPrimary: p.isPrimary === true || p.isPrimary === 'true',
    url: p.url ?? '',
    size: p.size ?? '',
    mimeType: p.mimeType ?? '',
    uploadedAt: p.uploadedAt ?? '',
    uploadedBy: p.uploadedBy ?? '',
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────────

/** All files attached to a given change order, identified by its coId. */
export function useEcoFilesByCoId(coId: string) {
  const bindingId = coId ? `eco-files-${coId}` : 'eco-files-none'
  const where = coId
    ? [{ property: 'properties.coId', filter: { operator: 'EQUAL' as const, value: coId } }]
    : []

  const result = useData<any[]>(bindingId, 'storage', {
    object: ECO_FILE,
    where,
    sort: [{ field: 'properties.uploadedAt', order: 'ASC' }],
    limit: 100,
  })

  return {
    files: (result.data ?? []).map(flattenEcoFile),
    loading: result.loading,
    error: result.error,
  }
}

// ─── Writes ──────────────────────────────────────────────────────────────────────

/** Save a new file record after a successful upload. Pass the url from useUppy. */
export function useCreateEcoFile() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (file: NewEcoFile) => {
    const result = await mutation.mutateAsync({
      data: {
        id: CREATE.id,
        context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: ECO_FILE, rawPayload: file },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return result
  }
}

/** Delete a file record by its backend id. */
export function useDeleteEcoFile() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (entityId: string) => {
    await mutation.mutateAsync({
      data: {
        id: DELETE.id,
        context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: ECO_FILE, entityId },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}
