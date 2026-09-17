/**
 * Automatic Task automation wrapper.
 * Given an ECO id + rejection notes, the automation extracts the missing item
 * and returns what to add: foundItem (pn, name), addTo (pn, name), op, qty.
 */
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const AUTOMATION_ID = '6aabb3906325543ce10d62b1'
const DATA_SOURCE_ID = 'e_6aabb8b5b3632f65c153f213'
const RESOURCE_VERSION = 70
const PAGE_SLUG = `global-page-of-${import.meta.env.VITE_APPLICATION_ID}`

export type AutoTaskResult = {
  foundItem: { pn: string; name: string }
  addTo: { pn: string; name: string }
  op: string
  qty: string
}

export function useAutomaticTask() {
  const { mutateAsync, isPending, error } = useExecuteWorkflowNodeMutation()

  async function run(ecoId: string, rejectionNotes: string): Promise<AutoTaskResult> {
    const result = await mutateAsync({
      data: {
        context: {
          appName: 'callables',
          resourceName: 'callables_call_automation',
          resourceVersion: RESOURCE_VERSION,
        },
        id: DATA_SOURCE_ID,
        inputs: {
          automationId: AUTOMATION_ID,
          version: '-1',
          runtimeConnections: {},
          parameters: {
            __internals__: { m: 'BUILDER', s: PAGE_SLUG, c: 'PLATFORM', p: 'browser' },
            ecoId,
            rejectionNotes,
          },
          synchronous: true,
        },
        options: {},
      },
    })

    const raw = (result?.response ?? {}) as Record<string, unknown>
    const foundItem = (raw.foundItem ?? {}) as { pn?: string; name?: string }
    const addTo = (raw.addTo ?? {}) as { pn?: string; name?: string }
    return {
      foundItem: { pn: foundItem.pn ?? '', name: foundItem.name ?? '' },
      addTo: { pn: addTo.pn ?? '', name: addTo.name ?? '' },
      op: typeof raw.op === 'string' ? raw.op : 'ADD',
      qty: typeof raw.qty === 'string' ? raw.qty : '1 EA',
    }
  }

  return { run, isPending, error }
}
