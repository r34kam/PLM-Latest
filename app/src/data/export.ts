/**
 * PLM Data Exporter automation wrapper.
 * Sends a dataType string ('bom_item' or 'item') and gets back a fileUrl
 * which the app opens automatically to trigger the Excel download.
 */
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const AUTOMATION_ID = '6aa927ff6bf08024e0104471'
const DATA_SOURCE_ID = 'e_6aa92bd865f80d499a6ed807'
const RESOURCE_VERSION = 66
const PAGE_SLUG = `global-page-of-${import.meta.env.VITE_APPLICATION_ID}`

export type ExportDataType = 'bom_item' | 'item'

export function useExportData() {
  const { mutateAsync, isPending, error, reset } = useExecuteWorkflowNodeMutation()

  async function runExport(dataType: ExportDataType): Promise<void> {
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
            dataType,
          },
          synchronous: true,
        },
        options: {},
      },
    })

    const fileUrl = (result?.response as { fileUrl?: string } | undefined)?.fileUrl
    if (fileUrl) {
      window.open(fileUrl, '_blank', 'noopener,noreferrer')
    }
  }

  return { runExport, isPending, error, reset }
}
