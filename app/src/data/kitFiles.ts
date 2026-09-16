/**
 * KitFile data layer — reads and writes for files attached to Kit/Item records.
 * Each KitFile links to a parent item via the `itemPn` field.
 * Components import from '@/data', never calling SDK hooks directly.
 */
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY, CREATE, DELETE } from './bindings'

const KIT_FILE = ENTITY.kitFile
const EXECUTE_NODE_QK = '/api/workflow/execute/node'

// ─── Types ────────────────────────────────────────────────────────────────────

export type KitFile = {
  id: string
  itemPn: string      // part number of the parent Kit/Item
  fileName: string    // original file name
  fileType: string    // Drawing, Work instruction, Inspection report, Specification, Certificate, Other
  visibility: string  // Internal only | Share with suppliers
  isPrimary: boolean  // is this the primary file?
  url: string         // stored URL from UnifyApps file storage
  size: string        // human-readable size e.g. "1.2 MB"
  mimeType: string    // MIME type
  uploadedAt: string  // ISO date string
}

export type NewKitFile = Omit<KitFile, 'id'>

// ─── Flatten helper ───────────────────────────────────────────────────────────

function flattenKitFile(raw: any): KitFile {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    itemPn: p.itemPn ?? '',
    fileName: p.fileName ?? '',
    fileType: p.fileType ?? 'Drawing',
    visibility: p.visibility ?? 'Internal only',
    isPrimary: p.isPrimary === true || p.isPrimary === 'true',
    url: p.url ?? '',
    size: p.size ?? '',
    mimeType: p.mimeType ?? '',
    uploadedAt: p.uploadedAt ?? '',
  }
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** All files attached to a given item/kit, identified by part number. */
export function useKitFilesByPn(itemPn: string) {
  const bindingId = itemPn ? `kit-files-${itemPn}` : 'kit-files-none'
  const where = itemPn
    ? [{ property: 'properties.itemPn', filter: { operator: 'EQUAL' as const, value: itemPn } }]
    : []

  const result = useData<any[]>(bindingId, 'storage', {
    object: KIT_FILE,
    where,
    sort: [{ field: 'properties.uploadedAt', order: 'DESC' }],
    limit: 100,
  })

  return {
    files: (result.data ?? []).map(flattenKitFile),
    loading: result.loading,
    error: result.error,
  }
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/** Save a new file record for a Kit/Item after a successful upload. */
export function useCreateKitFile() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (file: NewKitFile) => {
    const result = await mutation.mutateAsync({
      data: {
        id: CREATE.id,
        context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: KIT_FILE, rawPayload: file },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return result
  }
}

/** Delete a file record by its backend id. */
export function useDeleteKitFile() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (entityId: string) => {
    await mutation.mutateAsync({
      data: {
        id: DELETE.id,
        context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: KIT_FILE, entityId },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}
