/**
 * Items data layer — all reads and writes for the Item object go through here.
 * Components import from '@/data', never calling SDK hooks directly.
 */
import { useMemo } from 'react'
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { ENTITY, CREATE, UPDATE, DELETE, andFilter } from './bindings'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Item = {
  id: string           // backend record id (not the part number)
  pn: string           // part number, e.g. 1003140-01
  rev: string          // revision, e.g. C
  name: string         // item name
  cat: string          // category: KIT, ASSEMBLY, PCB, HARDWARE, etc.
  phase: string        // lifecycle phase: In Production, Discontinued, Prototype, Obsolete
  owner: string        // owner name
  plant: string        // SAP plant
  status: string       // SAP material status: 10 – NEW, 20 – ACTIVE, 50 – INACTIVE
  uom: string          // unit of measure, usually EA
  proc: string         // procurement type
  mg: string           // material group
  rohs: string         // RoHS: Yes, No, Exempt
  bom: number          // number of first-level BOM children (0 = component)
  div: string          // division: CO or AG
  created: string      // date created MM/DD/YYYY
  cost: string         // standard cost as decimal string
  assemblyType: string // Highest accessible assembly, Subassembly, Component
  primaryFile: string  // primary drawing/spec filename
  erpSystem: string    // SAP or No
  bomUsage: string     // Production, Sales, N/A
  description: string  // free-text description
  bomLines: string     // JSON-encoded BomLine[] array; '[]' for components
}

export type NewItem = Omit<Item, 'id'>

const ITEM = ENTITY.item

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Backend records arrive as { id, properties: { pn, name, ... }, ... }.
 * This flattens each record so fields are at the top level, matching the Item type
 * the app uses.
 */
function flattenRecord(raw: any): Item {
  const props = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    pn: props.pn ?? '',
    rev: props.rev ?? '',
    name: props.name ?? '',
    cat: props.cat ?? '',
    phase: props.phase ?? '',
    owner: props.owner ?? '',
    plant: props.plant ?? '',
    status: props.status ?? '',
    uom: props.uom ?? 'EA',
    proc: props.proc ?? '',
    mg: props.mg ?? '',
    rohs: props.rohs ?? '',
    bom: typeof props.bom === 'number' ? props.bom : Number(props.bom ?? 0),
    div: props.div ?? '',
    created: props.created ?? '',
    cost: props.cost ?? '',
    assemblyType: props.assemblyType ?? '',
    primaryFile: props.primaryFile ?? '',
    erpSystem: props.erpSystem ?? '',
    bomUsage: props.bomUsage ?? '',
    description: props.description ?? '',
    bomLines: props.bomLines ?? '[]',
  }
}

function flattenRecords(raw: any[] | undefined): Item[] {
  if (!raw) return []
  return raw.map(flattenRecord)
}

// ─── Reads ────────────────────────────────────────────────────────────────────

/** All items, no filter — used for aggregate KPI counts and the ECO item picker. */
export function useAllItems() {
  const result = useData<any[]>('items-all', 'storage', {
    object: ITEM,
    where: [],
    sort: [{ field: 'properties.name', order: 'ASC' }],
    limit: 500,
  })
  const data = useMemo(() => flattenRecords(result.data), [result.data])
  return { ...result, data }
}

/** One item by part number. Returns the matching record or undefined. */
export function useItemByPn(pn: string) {
  // Include pn in the binding id so different part numbers get distinct cache keys
  const bindingId = pn ? `item-by-pn-${pn}` : 'item-by-pn-none'
  const where = pn
    ? [{ property: 'properties.pn', filter: { operator: 'EQUAL' as const, value: pn } }]
    : []
  const result = useData<any[]>(bindingId, 'storage', {
    object: ITEM,
    where,
    sort: [],
    limit: 1,
  })
  return result.data?.[0] ? flattenRecord(result.data[0]) : undefined
}

// ─── Writes ───────────────────────────────────────────────────────────────────

/** Create a new item record. */
export function useCreateItem() {
  const mutate = useExecuteWorkflowNodeMutation()
  return (item: NewItem) =>
    mutate.mutateAsync({
      data: { id: CREATE.id, context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: ITEM, rawPayload: item } },
    })
}

/** Update an existing item by its backend record id. Send the full item payload. */
export function useUpdateItem() {
  const mutate = useExecuteWorkflowNodeMutation()
  return (recordId: string, item: NewItem) =>
    mutate.mutateAsync({
      data: { id: UPDATE.id, context: UPDATE.context,
        inputs: { ...UPDATE.storedInputs, object_type: ITEM, recordId, rawPayload: item } },
    })
}

/** Delete an item by its backend record id. */
export function useDeleteItem() {
  const mutate = useExecuteWorkflowNodeMutation()
  return (entityId: string) =>
    mutate.mutateAsync({
      data: { id: DELETE.id, context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: ITEM, entityId } },
    })
}
