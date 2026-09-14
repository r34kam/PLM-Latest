/**
 * BomItem data layer — reads and writes for BOM line items within a Kit.
 * Each BomItem links to a parent Kit via the `kitNumber` field.
 * Components import from '@/data', never calling SDK hooks directly.
 */
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY, CREATE, UPDATE, DELETE } from './bindings'

const BOM_ITEM = ENTITY.bomItem
const EXECUTE_NODE_QK = '/api/workflow/execute/node'

// ─── Types ──────────────────────────────────────────────────────────────────

export type BomItem = {
  id: string
  kitNumber: string   // part number of the parent KIT
  pn: string          // part number of the child component
  name: string        // display name of the child
  cat: string         // category: HARDWARE, PCB, ASSEMBLY, CABLE, etc.
  qty: string         // quantity with UOM suffix e.g. "4 EA"
  uom: string         // unit of measure: EA, M, KG, L
  refDes: string      // reference designator (optional, for PCBs)
  notes: string       // assembly notes
  addedAt: string     // ISO date when added
}

export type NewBomItem = Omit<BomItem, 'id'>

// ─── Flatten helper ──────────────────────────────────────────────────────────

function flattenBomItem(raw: any): BomItem {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    kitNumber: p.kitNumber ?? '',
    pn: p.pn ?? '',
    name: p.name ?? '',
    cat: p.cat ?? '',
    qty: p.qty ?? '1 EA',
    uom: p.uom ?? 'EA',
    refDes: p.refDes ?? '',
    notes: p.notes ?? '',
    addedAt: p.addedAt ?? '',
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** All BOM items across every kit — for cross-kit unique-parts analysis. */
export function useAllBomItems() {
  const result = useData<any[]>('bom-items-all', 'storage', {
    object: BOM_ITEM,
    where: [],
    sort: [{ field: 'properties.kitNumber', order: 'ASC' }],
    limit: 500,
  })
  return {
    bomItems: (result.data ?? []).map(flattenBomItem),
    loading: result.loading,
    error: result.error,
  }
}

/** All BOM items for a given Kit, identified by kitNumber. */
export function useBomItemsByKit(kitNumber: string) {
  const bindingId = kitNumber ? `bom-items-${kitNumber}` : 'bom-items-none'
  const where = kitNumber
    ? [{ property: 'properties.kitNumber', filter: { operator: 'EQUAL' as const, value: kitNumber } }]
    : []

  const result = useData<any[]>(bindingId, 'storage', {
    object: BOM_ITEM,
    where,
    sort: [{ field: 'properties.addedAt', order: 'ASC' }],
    limit: 200,
  })

  return {
    bomItems: (result.data ?? []).map(flattenBomItem),
    loading: result.loading,
    error: result.error,
  }
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/** Add a new BOM line item to a Kit. */
export function useCreateBomItem() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (item: NewBomItem) => {
    const result = await mutation.mutateAsync({
      data: {
        id: CREATE.id,
        context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: BOM_ITEM, rawPayload: item },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return result
  }
}

/** Update qty, refDes, or notes on an existing BOM line item. */
export function useUpdateBomItem() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (entityId: string, patch: Partial<Pick<BomItem, 'qty' | 'uom' | 'refDes' | 'notes'>>) => {
    await mutation.mutateAsync({
      data: {
        id: UPDATE.id,
        context: UPDATE.context,
        inputs: { ...UPDATE.storedInputs, object_type: BOM_ITEM, recordId: entityId, rawPayload: patch },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

/** Remove a BOM line item by its backend record id. */
export function useDeleteBomItem() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (entityId: string) => {
    await mutation.mutateAsync({
      data: {
        id: DELETE.id,
        context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: BOM_ITEM, entityId },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}
