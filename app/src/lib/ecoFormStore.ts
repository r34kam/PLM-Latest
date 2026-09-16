/**
 * Shared store for the live ECO form configuration.
 *
 * The Form Builder (Admin → Form Builder) writes here when the admin publishes
 * the "ECO Change Order Form". The ECO creation wizard reads from here to
 * render its Basic Details step dynamically.
 *
 * Persisted to localStorage so changes survive a page refresh.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EcoFormField = {
  l: string        // label
  t: string        // type: 'Single line text' | 'Long text' | 'Picklist' | 'Date' | 'Person'
  req: boolean     // required
  sap: boolean     // SAP-mapped
  sec: string      // section name
  opts?: string[]  // options for Picklist
}

// The two configurable section keys in the ECO wizard Basic Details step
export const SEC_CHANGE_DETAILS = 'Change Details'
export const SEC_CONFIRMATIONS = 'Confirmations & Processing'

// Default field set — matches the hardcoded fields currently in the ECO wizard
export const DEFAULT_ECO_BASIC_FIELDS: EcoFormField[] = [
  { l: 'Title', t: 'Single line text', req: true, sap: false, sec: SEC_CHANGE_DETAILS },
  { l: 'Redline instructions', t: 'Long text', req: false, sap: false, sec: SEC_CHANGE_DETAILS },
  { l: 'Validations complete?', t: 'Picklist', req: false, sap: false, sec: SEC_CONFIRMATIONS, opts: ['N/A', 'Yes', 'No'] },
  { l: 'Seed stock approved?', t: 'Picklist', req: false, sap: false, sec: SEC_CONFIRMATIONS, opts: ['N/A', 'Yes', 'No'] },
  { l: 'ECCN classification', t: 'Picklist', req: false, sap: false, sec: SEC_CONFIRMATIONS, opts: ['N/A — not used', 'Required — pending review', 'Cleared'] },
  { l: 'Inventory disposition filled?', t: 'Picklist', req: true, sap: true, sec: SEC_CONFIRMATIONS, opts: ['Yes', 'No'] },
  { l: 'DC Representative', t: 'Person', req: true, sap: false, sec: SEC_CONFIRMATIONS },
  { l: 'Status notes', t: 'Single line text', req: false, sap: false, sec: SEC_CONFIRMATIONS },
]

type EcoFormStore = {
  basicDetailsFields: EcoFormField[]
  lastPublished: string | null  // ISO timestamp of last publish
  publishFields: (fields: EcoFormField[]) => void
  resetToDefaults: () => void
}

export const useEcoFormStore = create<EcoFormStore>()(
  persist(
    (set) => ({
      basicDetailsFields: DEFAULT_ECO_BASIC_FIELDS,
      lastPublished: null,
      publishFields: (fields) =>
        set({ basicDetailsFields: fields, lastPublished: new Date().toISOString() }),
      resetToDefaults: () =>
        set({ basicDetailsFields: DEFAULT_ECO_BASIC_FIELDS, lastPublished: null }),
    }),
    { name: 'eco-form-config' }
  )
)
