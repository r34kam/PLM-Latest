/**
 * PLM Data Exporter automation wrapper.
 * Sends a dataType string ('bom_item' or 'item'), gets back a fileUrl,
 * then fetches the file as a blob and triggers a direct download —
 * no new tab or popup required.
 */
import { useExecuteWorkflowNodeMutation } from '@unifyapps/app-builder-sdk/hooks/workflow'

const AUTOMATION_ID = '6aa927ff6bf08024e0104471'
const DATA_SOURCE_ID = 'e_6aa92bd865f80d499a6ed807'
const RESOURCE_VERSION = 66
const PAGE_SLUG = `global-page-of-${import.meta.env.VITE_APPLICATION_ID}`

export type ExportDataType = 'bom_item' | 'item'

/** Derive a filename from the URL or fall back to a sensible default. */
function filenameFromUrl(url: string, dataType: ExportDataType): string {
  try {
    const pathname = new URL(url).pathname
    const last = pathname.split('/').pop()
    if (last && last.includes('.')) return decodeURIComponent(last)
  } catch { /* ignore */ }
  return dataType === 'bom_item' ? 'topcon-kits.xlsx' : 'topcon-parts.xlsx'
}

/** Fetch the file and trigger a browser download without opening a new tab. */
async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const resp = await fetch(url)
  const blob = await resp.blob()
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
}

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
      const filename = filenameFromUrl(fileUrl, dataType)
      await downloadFromUrl(fileUrl, filename)
    }
  }

  return { runExport, isPending, error, reset }
}
