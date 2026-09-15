/**
 * Kit BOM Change Extractor automation wrapper.
 * Sends free-text instructions and returns a kitNumber + items array.
 */
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const AUTOMATION_ID = '6aa92a06ba38311fd2690e6d'
const DATA_SOURCE_ID = 'e_6aa9351465f80d499a6eecf5'
const RESOURCE_VERSION = 66
const PAGE_SLUG = `global-page-of-${import.meta.env.VITE_APPLICATION_ID}`

export type ExtractedItem = {
  type: string    // 'add' | 'remove' | 'modify'
  pn: string
  name: string
  qty: string
  newValue: string
}

export type ExtractedKit = {
  kitNumber: string
  items: ExtractedItem[]
}

export function useKitExtractor() {
  const { mutateAsync, isPending, error } = useExecuteWorkflowNodeMutation()

  async function extract(inputText: string): Promise<ExtractedKit> {
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
            inputText,
          },
          synchronous: true,
        },
        options: {},
      },
    })

    const response = result?.response as { kitNumber?: string; items?: ExtractedItem[] } | undefined
    return {
      kitNumber: response?.kitNumber ?? '',
      items: response?.items ?? [],
    }
  }

  return { extract, isPending, error }
}
