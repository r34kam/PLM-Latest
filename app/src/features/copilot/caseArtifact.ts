/* Finding the HTML artifact a copilot reply produced.
 *
 * The agent does not put its HTML in the reply. It uploads a file and records a pointer to
 * it on the conversation's own record — a `service_hub_case` entity keyed by `chatId`:
 *
 *   properties.additional.lastPreviewDetails.canvas.props.downloadUrl
 *   properties.additional.lastPreviewDetails.canvas.props.fileName
 *
 * That record is the ONLY reliable source. Reading the chat DOM instead does not work, and
 * it is worth writing down why, because the markup looks like it should:
 *
 *   - there is no ```html fence to find. The reply is prose plus a file card.
 *   - there is no `<a href>` to the artifact either, and even when one exists the URL is
 *     `/api/file/download/__UNIFY_ENCR_…` with the name encrypted into the path — so the
 *     filename never appears in the href and no `.html` test can match it.
 *
 * These are pure functions over `fetch`, with no React, so the rules can be exercised
 * without mounting a chat.
 */

/** Same convention as `lib/passwordPolicy.ts`: empty on a deploy build (the app is
 * same-origin with the backend), and the engine's origin on a preview build, where the app
 * is served from somewhere else entirely. */
const API_BASE = import.meta.env.VITE_ENTITY_API_BASE || ''

export type CaseArtifact = {
  /** absolute or root-relative URL of the artifact file */
  url: string
  /** the agent's own name for it, for the panel title */
  fileName?: string
}

/** Shape of the slice of `service_hub_case` we care about. Everything is optional because
 * a conversation that has not produced an artifact yet simply has none of it. */
type LookupResponse = {
  response?: {
    objects?: Record<
      string,
      {
        properties?: {
          additional?: {
            lastPreviewDetails?: {
              canvas?: {
                props?: {
                  downloadUrl?: string
                  previewUrl?: string
                  fileName?: string
                  displayFormat?: string
                }
              }
            }
          }
        }
      }
    >
  }
}

/** Read the artifact pointer off the conversation record, or null when there isn't one.
 *
 * Throws on a transport or HTTP failure so the caller can show the reason. "No artifact
 * yet" is a null return, not an error — it is the normal state of a fresh conversation. */
export async function fetchCaseArtifact(
  chatId: string,
  signal?: AbortSignal,
): Promise<CaseArtifact | null> {
  const res = await fetch(`${API_BASE}/api/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // The conversation record is session-scoped, so the call has to carry the session.
    // Cross-origin on a preview build, same-origin on a deploy build.
    credentials: API_BASE ? 'include' : 'same-origin',
    body: JSON.stringify({
      lookupType: 'ENTITY_ID:service_hub_case',
      keys: [chatId],
      type: 'ByKeys',
    }),
    signal,
  })
  if (!res.ok) throw new Error(`The conversation record could not be read (${res.status}).`)

  const body = (await res.json()) as LookupResponse
  const props = body.response?.objects?.[chatId]?.properties?.additional?.lastPreviewDetails
    ?.canvas?.props
  if (!props) return null

  // `downloadUrl` is the canonical one. `previewUrl` is a different signed URL for the same
  // bytes and is read only as a fallback — it is NOT a fix for anything on its own: both
  // are served as attachments, which is why the file is fetched rather than framed.
  const url = props.downloadUrl || props.previewUrl
  if (!url) return null

  return { url, fileName: props.fileName }
}

/** Fetch the artifact's markup.
 *
 * `fetch` rather than pointing an iframe at the URL, and that is the whole point of this
 * module. `/api/file/download/…` redirects to object storage and the redirect target is a
 * presigned URL with `Content-Disposition: attachment` signed INTO the signature — it
 * cannot be stripped with a query parameter. A frame navigating there hands the response to
 * the download manager and is left showing an empty document, with no error anywhere:
 * `readyState` still reaches `complete`, the network tab still shows 200 text/html.
 *
 * `fetch` ignores `Content-Disposition` entirely, so the same URL yields the markup. */
export async function fetchArtifactHtml(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    credentials: API_BASE ? 'include' : 'same-origin',
    signal,
  })
  if (!res.ok) throw new Error(`The server answered ${res.status} ${res.statusText}.`)
  const text = await res.text()
  if (!text.trim()) throw new Error('The file came back empty.')
  return text
}
