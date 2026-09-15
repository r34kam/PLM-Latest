import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const AUTOMATION_ID = '6aa8b7db8301093ee4e300e7'
const DATA_SOURCE_ID = 'e_6aa8be960ce52e61ae78424c'
const RESOURCE_VERSION = 62
const PAGE_SLUG = `global-page-of-${import.meta.env.VITE_APPLICATION_ID}`

export type AiSuggestion = {
  g: string       // role name
  who: string     // comma-separated approvers
  conf: number    // 0–100 confidence
  why: string     // reasoning text
  drop?: boolean  // true = pre-unchecked (AI recommends skipping)
}

export type EcoApprovalFlowInput = {
  coId: string
  type?: string
  cat?: string
  routing?: string
  div?: string
  site?: string
  title?: string
  desc?: string
  redline?: string
  pnsJson?: string
  itemCount?: number
  modCount?: number
  priority?: string
  creator?: string
  submitter?: string
}

export function useEcoApprovalFlow() {
  const { mutateAsync, isPending, error, reset } = useExecuteWorkflowNodeMutation()

  async function run(input: EcoApprovalFlowInput): Promise<AiSuggestion[]> {
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
            ...input,
          },
          synchronous: true,
        },
        options: {},
      },
    })

    const response = (result?.response ?? {}) as { approvalFlow?: AiSuggestion[] }
    const flow = response.approvalFlow
    if (!Array.isArray(flow)) throw new Error('Unexpected response from ECO Approval Flow Generator')
    return flow
  }

  return { run, isPending, error, reset }
}
