/**
 * ECO Rejection data layer.
 * Rejection details can't be stored on the change_order record (schema locked),
 * so each rejection is its own record here, linked by ecoId.
 */
import { useMemo } from 'react'
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY, CREATE } from './bindings'

const ER = ENTITY.ecoRejection
const EXECUTE_NODE_QK = '/api/workflow/execute/node'

export type EcoRejectionRecord = {
  id: string
  ecoId: string
  reason: string
  notes: string
  rejectedBy: string
  timestamp: number
}

function flatten(raw: any): EcoRejectionRecord {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    ecoId: p.ecoId ?? '',
    reason: p.reason ?? '',
    notes: p.notes ?? '',
    rejectedBy: p.rejectedBy ?? '',
    timestamp: typeof p.timestamp === 'number' ? p.timestamp : Number(p.timestamp ?? 0),
  }
}

/** Latest rejection record for a given ECO coId. */
export function useEcoRejection(ecoId: string) {
  const result = useData<any[]>(`eco-rejection-${ecoId}`, 'storage', {
    object: ER,
    where: ecoId
      ? [{ property: 'properties.ecoId', filter: { operator: 'EQUAL' as const, value: ecoId } }]
      : [],
    sort: [{ field: 'properties.timestamp', order: 'DESC' as const }],
    limit: 1,
  })
  const rejection = useMemo(
    () => (result.data ?? []).map(flatten)[0] ?? null,
    [result.data],
  )
  return { rejection, loading: result.loading, error: result.error }
}

/** Save a rejection record for an ECO. */
export function useSaveEcoRejection() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (r: Omit<EcoRejectionRecord, 'id'>) => {
    await mutation.mutateAsync({
      data: {
        id: CREATE.id,
        context: CREATE.context,
        inputs: {
          ...CREATE.storedInputs,
          object_type: ER,
          rawPayload: {
            ecoId: r.ecoId,
            reason: r.reason,
            notes: r.notes,
            rejectedBy: r.rejectedBy,
            timestamp: r.timestamp,
          },
        },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}
