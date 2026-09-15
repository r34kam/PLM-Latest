/**
 * Send ECO Notification automation wrapper.
 * Sends a reminder to a specific approver for a given ECO number.
 */
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const AUTOMATION_ID = '6aa923414ba86f23a73619a7'
const DATA_SOURCE_ID = 'e_6aa92d230ce52e61ae78ea3c'
const RESOURCE_VERSION = 66
const PAGE_SLUG = `global-page-of-${import.meta.env.VITE_APPLICATION_ID}`

export function useSendReminder() {
  const { mutateAsync, isPending, error, reset } = useExecuteWorkflowNodeMutation()

  async function sendReminder(eco_number: string, person_name: string): Promise<string | undefined> {
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
            eco_number,
            person_name,
          },
          synchronous: true,
        },
        options: {},
      },
    })

    return (result?.response as { result?: string } | undefined)?.result
  }

  return { sendReminder, isPending, error, reset }
}
