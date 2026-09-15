/**
 * Backend data hooks for PLM admin entities:
 *   - PLM Users    (plm_user_e_6aa7db00090ece2e78f2808b)
 *   - PLM Routings (plm_routing_e_6aa7db00090ece2e78f2808b)
 *   - PLM Forms    (plm_form_e_6aa7db00090ece2e78f2808b)
 *
 * All reads go through `useData` so they appear in the platform's Data panel.
 * All writes go through `useExecuteWorkflowNodeMutation` with the shared bindings.
 * Components import from `@/data`, never calling hooks directly.
 */
import { useData } from '@/lib/data'
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'
import { useQueryClient } from '@tanstack/react-query'
import { ENTITY, CREATE, UPDATE, DELETE } from './bindings'

// The SDK uses this as the first element of every execute-node query key.
// Invalidating on this prefix refreshes ALL useData('storage') bindings in one call.
const EXECUTE_NODE_QK = '/api/workflow/execute/node'

// ─── Types ──────────────────────────────────────────────────────────────────

export type PlmRole = {
  id: string
  name: string         // Full role name e.g. "Document Control TPS – Livermore"
  division: string     // 'CO' | 'AG' | 'Both'
  site: string         // 'Livermore' | 'Fort Collins' | 'Adelaide' | 'Tokyo' | 'All sites'
  membersJson: string  // JSON array of plm_user record IDs
}

export type PlmAiInsight = {
  id: string
  ecoId: string
  lead: string         // one-line headline shown collapsed
  detail: string       // expanded explanation
  sub: string          // small metadata line
  tone: string         // 'warn' | 'ok' | 'bad' | 'blue' | 'vio'
}

export type PlmNotification = {
  id: string
  ecoId: string
  title: string
  detail: string
  timestamp: string
  tone: string         // 'warn' | 'ok' | 'bad' | 'blue' | 'vio'
  group: string        // 'Today' | 'Earlier'
}

export type PlmUser = {
  id: string
  name: string
  email: string
  group: string
  site: string
  division: string
  type: string         // 'Employee' | 'Partner'
  access: string       // 'Administrator' | 'Standard user' | 'View only'
  active: boolean
  aiInsights: PlmAiInsight[]    // parsed from aiInsightsJson
  notifications: PlmNotification[]  // parsed from notificationsJson
}

export type PlmRouting = {
  id: string
  name: string
  division: string
  stagesJson: string   // JSON array of stage objects
  formId: string
  used: number
}

export type PlmForm = {
  id: string
  name: string
  type: string
  description: string
  sectionsJson: string  // JSON array of section name strings
  fieldsJson: string    // JSON array of field objects
  updatedAt: string
}

// ─── Flatten helpers ─────────────────────────────────────────────────────────

function flattenRole(raw: any): PlmRole {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    name: p.name ?? '',
    division: p.division ?? 'Both',
    site: p.site ?? 'All sites',
    membersJson: p.membersJson ?? '[]',
  }
}

function parseJson<T>(raw: string | T | undefined | null, fallback: T): T {
  if (raw == null) return fallback
  // Already parsed by the platform (e.g. the field came back as an object/array)
  if (typeof raw !== 'string') return raw as T
  if (raw.trim() === '') return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

function flattenUser(raw: any): PlmUser {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    name: p.name ?? '',
    email: p.email ?? '',
    group: p.group ?? '',
    site: p.site ?? '',
    division: p.division ?? '',
    type: p.type ?? 'Employee',
    access: p.access ?? 'Standard user',
    active: p.active !== false,
    aiInsights: parseJson<PlmAiInsight[]>(p.aiInsightsJson, []),
    notifications: parseJson<PlmNotification[]>(p.notificationsJson, []),
  }
}

function flattenRouting(raw: any): PlmRouting {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    name: p.name ?? '',
    division: p.division ?? '',
    stagesJson: p.stagesJson ?? '[]',
    formId: p.formId ?? 'form-eco',
    used: typeof p.used === 'number' ? p.used : Number(p.used ?? 0),
  }
}

function flattenForm(raw: any): PlmForm {
  const p = raw?.properties ?? raw ?? {}
  return {
    id: raw?.id ?? '',
    name: p.name ?? '',
    type: p.type ?? '',
    description: p.description ?? '',
    sectionsJson: p.sectionsJson ?? '[]',
    fieldsJson: p.fieldsJson ?? '[]',
    updatedAt: p.updatedAt ?? '',
  }
}

// ─── Query key constants ─────────────────────────────────────────────────────
const QK_USERS = 'plm-users'
const QK_ROUTINGS = 'plm-routings'
const QK_FORMS = 'plm-forms'
const QK_ROLES = 'plm-roles'

// ─── Users ───────────────────────────────────────────────────────────────────

export function useUsers() {
  const { data, loading, error } = useData<any[]>(QK_USERS, 'storage', {
    object: ENTITY.plmUser,
    where: [],
    sort: [{ field: 'id', order: 'DESC' }],
    limit: 200,
  })
  return {
    users: (data ?? []).map(flattenUser),
    loading,
    error,
  }
}

export type PlmUserPayload = Omit<PlmUser, 'id' | 'aiInsights' | 'notifications'> & {
  aiInsightsJson?: string
  notificationsJson?: string
}

export function useCreateUser() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (user: PlmUserPayload) => {
    const result = await mutation.mutateAsync({
      data: { id: CREATE.id, context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: ENTITY.plmUser, rawPayload: user } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return result
  }
}

export function useUpdateUser() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string, user: PlmUserPayload) => {
    await mutation.mutateAsync({
      data: { id: UPDATE.id, context: UPDATE.context,
        inputs: { ...UPDATE.storedInputs, object_type: ENTITY.plmUser, recordId: id, rawPayload: user } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

export function useDeleteUser() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string) => {
    await mutation.mutateAsync({
      data: { id: DELETE.id, context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: ENTITY.plmUser, entityId: id } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

// ─── Routings ────────────────────────────────────────────────────────────────

// Finds the plm_user record whose email matches the logged-in user's identity
// and returns their ECO-scoped aiInsights and notifications.
export function useCurrentUserRecord(userEmail: string) {
  const { users, loading, error } = useUsers()
  const user = users.find((u) => u.email.toLowerCase() === userEmail.toLowerCase()) ?? null
  return { user, loading, error }
}

export function useRoutings() {
  const { data, loading, error } = useData<any[]>(QK_ROUTINGS, 'storage', {
    object: ENTITY.plmRouting,
    where: [],
    sort: [{ field: 'id', order: 'DESC' }],
    limit: 100,
  })
  return {
    routings: (data ?? []).map(flattenRouting),
    loading,
    error,
  }
}

export function useCreateRouting() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (routing: Omit<PlmRouting, 'id'>) => {
    const result = await mutation.mutateAsync({
      data: { id: CREATE.id, context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: ENTITY.plmRouting, rawPayload: routing } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return result
  }
}

export function useUpdateRouting() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string, routing: Omit<PlmRouting, 'id'>) => {
    await mutation.mutateAsync({
      data: { id: UPDATE.id, context: UPDATE.context,
        inputs: { ...UPDATE.storedInputs, object_type: ENTITY.plmRouting, recordId: id, rawPayload: routing } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

export function useDeleteRouting() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string) => {
    await mutation.mutateAsync({
      data: { id: DELETE.id, context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: ENTITY.plmRouting, entityId: id } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

// ─── Forms ───────────────────────────────────────────────────────────────────

export function useForms() {
  const { data, loading, error } = useData<any[]>(QK_FORMS, 'storage', {
    object: ENTITY.plmForm,
    where: [],
    sort: [{ field: 'properties.name', order: 'ASC' }],
    limit: 100,
  })
  return {
    forms: (data ?? []).map(flattenForm),
    loading,
    error,
  }
}

export function useCreateForm() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (form: Omit<PlmForm, 'id'>) => {
    const result = await mutation.mutateAsync({
      data: { id: CREATE.id, context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: ENTITY.plmForm, rawPayload: form } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return result
  }
}

export function useUpdateForm() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string, form: Omit<PlmForm, 'id'>) => {
    await mutation.mutateAsync({
      data: { id: UPDATE.id, context: UPDATE.context,
        inputs: { ...UPDATE.storedInputs, object_type: ENTITY.plmForm, recordId: id, rawPayload: form } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

export function useDeleteForm() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string) => {
    await mutation.mutateAsync({
      data: { id: DELETE.id, context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: ENTITY.plmForm, entityId: id } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

// ─── Roles ──────────────────────────────────────────────────────────────────

export function useRoles() {
  const { data, loading, error } = useData<any[]>(QK_ROLES, 'storage', {
    object: ENTITY.plmRole,
    where: [],
    sort: [{ field: 'id', order: 'DESC' }],
    limit: 200,
  })
  return {
    roles: (data ?? []).map(flattenRole),
    loading,
    error,
  }
}

export function useCreateRole() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (role: Omit<PlmRole, 'id'>) => {
    const result = await mutation.mutateAsync({
      data: { id: CREATE.id, context: CREATE.context,
        inputs: { ...CREATE.storedInputs, object_type: ENTITY.plmRole, rawPayload: role } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
    return result
  }
}

export function useUpdateRole() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string, role: Omit<PlmRole, 'id'>) => {
    await mutation.mutateAsync({
      data: { id: UPDATE.id, context: UPDATE.context,
        inputs: { ...UPDATE.storedInputs, object_type: ENTITY.plmRole, recordId: id, rawPayload: role } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

export function useDeleteRole() {
  const mutation = useExecuteWorkflowNodeMutation()
  const qc = useQueryClient()
  return async (id: string) => {
    await mutation.mutateAsync({
      data: { id: DELETE.id, context: DELETE.context,
        inputs: { ...DELETE.storedInputs, object_type: ENTITY.plmRole, entityId: id } },
    })
    qc.invalidateQueries({ queryKey: [EXECUTE_NODE_QK] })
  }
}

