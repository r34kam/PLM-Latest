/**
 * ECO Comment data layer.
 * Each comment is its own backend record — no JSON blobs, no merge conflicts.
 * Multiple users can post simultaneously without overwriting each other.
 */
import { useMemo } from 'react'
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY, CREATE, andFilter, pageInput } from './bindings'

const EC = ENTITY.ecoComment
const EXECUTE_NODE_QK = '/api/workflow/execute/node'

export type EcoCommentRecord = {
  /** Backend record id */
  id: string
  ecoId: string
  author: string
  message: string
  /** Epoch milliseconds */
  timestamp: number
}

function flattenComment(raw: any): EcoCommentRecord {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    ecoId: p.ecoId ?? '',
    author: p.author ?? '',
    message: p.message ?? '',
    timestamp: typeof p.timestamp === 'number' ? p.timestamp : Number(p.timestamp ?? 0),
  }
}

/** All comments for a given ECO coId, newest first. */
export function useEcoComments(ecoId: string) {
  const result = useData<any[]>(`eco-comments-${ecoId}`, 'storage', {
    object: EC,
    where: ecoId
      ? [{ property: 'properties.ecoId', filter: { operator: 'EQUAL' as const, value: ecoId } }]
      : [],
    sort: [{ field: 'properties.timestamp', order: 'ASC' as const }],
    limit: 200,
  })
  const comments = useMemo(
    () => (result.data ?? []).map(flattenComment),
    [result.data],
  )
  return { comments, loading: result.loading, error: result.error }
}

/** Post a new comment. Returns immediately — call site adds optimistic update. */
export function usePostEcoComment() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (comment: Omit<EcoCommentRecord, 'id'>) => {
    await mutation.mutateAsync({
      data: {
        id: CREATE.id,
        context: CREATE.context,
        inputs: {
          ...CREATE.storedInputs,
          object_type: EC,
          rawPayload: {
            ecoId: comment.ecoId,
            author: comment.author,
            message: comment.message,
            timestamp: comment.timestamp,
          },
        },
      },
    })
    // Invalidate so the thread refetches the confirmed record
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}
