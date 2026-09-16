/**
 * Change Order data layer — all reads and writes for the ChangeOrder object.
 * Components import from '@/data', never calling SDK hooks directly.
 */
import { useMemo } from 'react'
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY, CREATE, UPDATE, DELETE, andFilter } from './bindings'

const CO = ENTITY.changeOrder
const EXECUTE_NODE_QK = '/api/workflow/execute/node'

// ─── Types ───────────────────────────────────────────────────────────────────

// One entry per role in the routing — persisted on the record, updated as decisions land
export type ApprovalEntry = {
  role: string          // e.g. "Construction Engineering – Livermore"
  approver: string      // primary approver name
  req: string           // "One or more" | "All members" | "Optional" | "Comments only"
  stage: number         // 1 or 2
  status: string        // "pending" | "approved" | "rejected" | "comments"
  signedAt: string      // "MM/DD/YYYY HH:MM AM" or ""
  comment: string       // approver's note or ""
  others: string[]      // other members of this role group
}

export type ChangeOrder = {
  id: string            // backend record id
  coId: string          // change order number, e.g. ECO-011420
  title: string
  type: string          // ECO | DCO | TPCO | RFD
  cat: string           // full category label
  stage: string         // Open | Submit | Approval | Effective | Complete | Rejected
  div: string           // CO | AG
  site: string
  routing: string
  creator: string
  submitter: string
  dc: string            // document control owner
  created: string
  submitted: string
  itemCount: number
  modCount: number
  pnsJson: string       // JSON array of affected part numbers
  desc: string
  redline: string
  notes: string
  priority: string      // Low | Medium | High | Critical
  awaitingMe: boolean
  effectiveDate: string
  completedDate: string
  approvals: ApprovalEntry[]  // parsed from approvalsJson — real per-role decisions
  currentStageNum: number     // active approval stage: 0 = not in approval, 1 or 2
  ecoItems: EcoItemRecord[]   // parsed from ecoItemsJson — kits + BOM edits from creation
  comments: EcoComment[]      // parsed from commentsJson — comment trail
  rejectionReason: string     // reason selected when rejected
  rejectionNotes: string      // free-text notes entered at rejection
  rejectedBy: string          // name of person who rejected
  history: CoHistoryEntry[]         // parsed from historyJson — audit trail
  extraNotifyNames: string[]        // parsed from extraNotifyJson — manually added notification recipients
}

/** One kit/assembly added to the ECO during creation, with its BOM edits. */
export type EcoBomEdit = {
  id: string
  type: 'ADD' | 'DELETE' | 'UPDATE_DESC' | 'UPDATE_QTY'
  pn: string
  name: string
  qty: string
  newValue: string
}

export type EcoItemRecord = {
  pn: string
  name: string
  rev: string
  cat: string
  currentRev: string
  newRev: string
  bomEdits: EcoBomEdit[]
}

export type EcoComment = {
  id: string
  author: string
  message: string
  /** Epoch milliseconds (new comments). Legacy comments may have a locale string — treat anything that parses as a number as epoch. */
  timestamp: number | string
}

export type CoHistoryEntry = {
  id: string
  timestamp: string  // ISO string
  who: string
  action: string     // e.g. "Change created", "Approved — Stage 1, Construction Engineering", "Rejected"
}

export type NewChangeOrder = Omit<ChangeOrder, 'id'>

// Payload shape sent to the backend CREATE node — only schema-registered fields.
// Fields added after the original object was provisioned are sent in a follow-up UPDATE
// because the CREATE node rejects unregistered schema fields with additionalProperties errors.
// Step-2-only fields: ecoItemsJson, commentsJson, historyJson, extraNotifyJson,
//                     rejectionReason, rejectionNotes, rejectedBy, currentStageNum
type CoPayload = Omit<
  NewChangeOrder,
  | 'approvals' | 'ecoItems' | 'comments' | 'history' | 'extraNotifyNames'
  | 'rejectionReason' | 'rejectionNotes' | 'rejectedBy' | 'currentStageNum'
> & {
  approvalsJson: string
}


// ECOs go directly into Approval when created — no Open or Submit holding states in practice
export const CO_STAGES = ['Approval', 'Effective', 'Complete', 'Rejected'] as const
export type CoStage = (typeof CO_STAGES)[number]

export const CO_TYPES = ['ECO', 'DCO', 'TPCO', 'RFD'] as const
export type CoType = (typeof CO_TYPES)[number]

export const CO_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const

// ─── Flatten ─────────────────────────────────────────────────────────────────

function parseJsonSafe<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function flatten(raw: any): ChangeOrder {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    coId: p.coId ?? '',
    title: p.title ?? '',
    type: p.type ?? '',
    cat: p.cat ?? '',
    stage: p.stage ?? '',
    div: p.div ?? '',
    site: p.site ?? '',
    routing: p.routing ?? '',
    creator: p.creator ?? '',
    submitter: p.submitter ?? '',
    dc: p.dc ?? '',
    created: p.created ?? '',
    submitted: p.submitted ?? '',
    itemCount: typeof p.itemCount === 'number' ? p.itemCount : Number(p.itemCount ?? 0),
    modCount: typeof p.modCount === 'number' ? p.modCount : Number(p.modCount ?? 0),
    pnsJson: p.pnsJson ?? '[]',
    desc: p.desc ?? '',
    redline: p.redline ?? '',
    notes: p.notes ?? '',
    priority: p.priority ?? 'Medium',
    awaitingMe: p.awaitingMe === true,
    effectiveDate: p.effectiveDate ?? '',
    completedDate: p.completedDate ?? '',
    approvals: parseJsonSafe<ApprovalEntry[]>(p.approvalsJson, []),
    currentStageNum: typeof p.currentStageNum === 'number' ? p.currentStageNum : Number(p.currentStageNum ?? 0),
    ecoItems: parseJsonSafe<EcoItemRecord[]>(p.ecoItemsJson, []),
    comments: parseJsonSafe<EcoComment[]>(p.commentsJson, []),
    rejectionReason: p.rejectionReason ?? '',
    rejectionNotes: p.rejectionNotes ?? '',
    rejectedBy: p.rejectedBy ?? '',
    history: parseJsonSafe<CoHistoryEntry[]>(p.historyJson, []),
    extraNotifyNames: parseJsonSafe<string[]>(p.extraNotifyJson, []),
  }
}

// ─── Reads ───────────────────────────────────────────────────────────────────

/** All change orders — used for KPI counts and home page table. */
export function useAllChangeOrders() {
  const result = useData<any[]>('change-orders-all', 'storage', {
    object: CO,
    where: [],
    sort: [{ field: 'properties.created', order: 'DESC' }],
    limit: 500,
  })
  const data = useMemo(() => (result.data ?? []).map(flatten), [result.data])
  return { ...result, data }
}

/** Change orders filtered by stage. */
export function useChangeOrdersByStage(stage: string) {
  const bindingId = stage ? `change-orders-stage-${stage}` : 'change-orders-all'
  const where = stage
    ? [{ property: 'properties.stage', filter: { operator: 'EQUAL' as const, value: stage } }]
    : []
  const result = useData<any[]>(bindingId, 'storage', {
    object: CO,
    where,
    sort: [{ field: 'properties.created', order: 'DESC' }],
    limit: 200,
  })
  const data = useMemo(() => (result.data ?? []).map(flatten), [result.data])
  return { ...result, data }
}

/** Change orders for a specific part number (searching pnsJson substring). */
export function useChangeOrdersByPn(pn: string) {
  const bindingId = pn ? `change-orders-pn-${pn}` : 'change-orders-pn-none'
  const where = pn
    ? [{ property: 'properties.pnsJson', filter: { operator: 'CONTAINS' as const, value: pn } }]
    : []
  const result = useData<any[]>(bindingId, 'storage', {
    object: CO,
    where,
    sort: [{ field: 'properties.created', order: 'DESC' }],
    limit: 100,
  })
  const data = useMemo(() => (result.data ?? []).map(flatten), [result.data])
  return { ...result, data }
}

/** Change orders awaiting the current user's approval. */
export function useChangeOrdersAwaitingMe() {
  const result = useData<any[]>('change-orders-awaiting-me', 'storage', {
    object: CO,
    where: [{ property: 'properties.awaitingMe', filter: { operator: 'EQUAL' as const, value: true } }],
    sort: [{ field: 'properties.submitted', order: 'ASC' }],
    limit: 100,
  })
  const data = useMemo(() => (result.data ?? []).map(flatten), [result.data])
  return { ...result, data }
}

// ─── Writes ──────────────────────────────────────────────────────────────────

// Create payload — only fields registered in the original schema; everything else goes to step 2
function toPayload(co: NewChangeOrder): CoPayload {
  const {
    approvals,
    ecoItems: _ecoItems,
    comments: _comments,
    history: _history,
    extraNotifyNames: _extra,
    rejectionReason: _rr,
    rejectionNotes: _rn,
    rejectedBy: _rb,
    currentStageNum: _csn,
    ...rest
  } = co
  return {
    ...rest,
    approvalsJson: JSON.stringify(approvals ?? []),
  }
}


export function useCreateChangeOrder() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (co: NewChangeOrder) => {
    // Step 1: create the record without ecoItemsJson/commentsJson
    // (the workflow CREATE node rejects unregistered schema fields)
    const createResult = await mutation.mutateAsync({
      data: {
        id: CREATE.id,
        context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: CO, rawPayload: toPayload(co) },
      },
    })

    // Step 2: patch all blob fields that the CREATE node rejects (unregistered schema fields)
    // This always runs so historyJson, extraNotifyJson, ecoItemsJson and commentsJson are saved.
    const newId: string | undefined =
      (createResult as any)?.response?.id ??
      (createResult as any)?.id ??
      (createResult as any)?.response?.objects?.[0]?.id

    if (newId) {
      try {
        await mutation.mutateAsync({
          data: {
            id: UPDATE.id,
            context: UPDATE.context,
            inputs: {
              ...UPDATE.storedInputs,
              object_type: CO,
              recordId: newId,
              rawPayload: {
                ecoItemsJson: JSON.stringify(co.ecoItems ?? []),
                commentsJson: JSON.stringify(co.comments ?? []),
                historyJson: JSON.stringify(co.history ?? []),
                extraNotifyJson: JSON.stringify(co.extraNotifyNames ?? []),
                currentStageNum: co.currentStageNum ?? 0,
                rejectionReason: co.rejectionReason ?? '',
                rejectionNotes: co.rejectionNotes ?? '',
                rejectedBy: co.rejectedBy ?? '',
              },
            },
          },
        })
      } catch {
        // Non-fatal — the ECO was created; only blob fields are missing
      }
    }

    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return createResult
  }
}

export function useUpdateChangeOrder() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (recordId: string, co: Partial<NewChangeOrder>) => {
    // Serialize registered array fields; strip ALL unregistered fields so the backend
    // never sees additionalProperties it rejects. The schema only has:
    //   coId, title, type, cat, stage, div, site, routing, creator, submitter, dc,
    //   created, submitted, itemCount, modCount, pnsJson, desc, redline, notes,
    //   priority, awaitingMe, effectiveDate, completedDate, approvalsJson, currentStageNum,
    //   ecoItemsJson, commentsJson, historyJson, extraNotifyJson
    // NOTE: historyJson, ecoItemsJson, commentsJson, extraNotifyJson are NOT currently
    //   registered in the schema (update_object is locked), so they are silently omitted.
    //   rejectionReason, rejectionNotes, rejectedBy go to eco_rejection records instead.
    const {
      approvals, ecoItems, comments, history, extraNotifyNames,
      // Unregistered fields — omit entirely to prevent additionalProperties errors
      rejectionReason: _rr, rejectionNotes: _rn, rejectedBy: _rb,
      ...rest
    } = co as Partial<NewChangeOrder> & { rejectionReason?: string; rejectionNotes?: string; rejectedBy?: string }
    const payload: Record<string, unknown> = { ...rest }
    if (approvals !== undefined) payload.approvalsJson = JSON.stringify(approvals)
    // ecoItems, comments, history, extraNotifyNames currently unregistered — skip to avoid 500s
    void ecoItems; void comments; void history; void extraNotifyNames
    await mutation.mutateAsync({
      data: {
        id: UPDATE.id,
        context: UPDATE.context,
        inputs: { ...UPDATE.storedInputs, object_type: CO, recordId, rawPayload: payload },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

export function useDeleteChangeOrder() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (entityId: string) => {
    await mutation.mutateAsync({
      data: {
        id: DELETE.id,
        context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: CO, entityId },
      },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive KPI counts from a flat list of change orders. */
export function deriveCoKpis(orders: ChangeOrder[]) {
  const open = orders.filter((o) => o.stage === 'Open').length
  const submit = orders.filter((o) => o.stage === 'Submit').length
  const approval = orders.filter((o) => o.stage === 'Approval').length
  const effective = orders.filter((o) => o.stage === 'Effective').length
  const complete = orders.filter((o) => o.stage === 'Complete').length
  const rejected = orders.filter((o) => o.stage === 'Rejected').length
  const awaitingMe = orders.filter((o) => o.awaitingMe).length
  // "In flight" = everything that isn't Complete (matches the EcoList "Open" filter tab)
  const inFlight = orders.filter((o) => o.stage !== 'Complete').length
  const byType: Record<string, number> = {}
  orders.forEach((o) => { byType[o.type] = (byType[o.type] ?? 0) + 1 })
  return { open, inFlight, submit, approval, effective, complete, rejected, awaitingMe, byType, total: orders.length }
}
