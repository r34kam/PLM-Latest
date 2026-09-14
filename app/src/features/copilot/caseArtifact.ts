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

/** Does this artifact's declared format mean "a page a browser can render"? */
function isHtmlFormat(props: { displayFormat?: string; fileName?: string }): boolean {
  if (props.displayFormat) return /html/i.test(props.displayFormat)
  return /\.html?$/i.test(props.fileName ?? '')
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

/* ---------------------------------------------------------------------------------------
 * Every artifact in a conversation, not just the newest.
 *
 * `lastPreviewDetails` on the case record holds exactly one pointer — the most recent — so
 * it cannot answer "open the one I clicked". The conversation's MESSAGES each carry their
 * own `previewDetails`, which is the only place an older artifact's URL survives.
 *
 * This is the same call the copilot itself makes to render the transcript
 * (`/api/workflow/execute/node?fetchConversation=…`), so it costs nothing the screen was
 * not already paying.
 * ------------------------------------------------------------------------------------- */

type ConversationMessage = {
  messageId?: string
  createdTime?: number
  previewDetails?: {
    canvas?: {
      props?: { downloadUrl?: string; previewUrl?: string; fileName?: string; displayFormat?: string }
    }
  }
}

/** The copilot's automations are registered per environment, so the id is looked up rather
 * than written down. Memoised because it cannot change within a page's life. */
let automationIdPromise: Promise<string> | null = null

function fetchConversationAutomationId(signal?: AbortSignal): Promise<string> {
  automationIdPromise ??= (async () => {
    const res = await fetch(`${API_BASE}/api/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: API_BASE ? 'include' : 'same-origin',
      body: JSON.stringify({
        type: 'ByQuery',
        lookupType: 'ENTITY',
        options: { entity_type: 'co_pilot_config' },
        filter: { op: 'EQUAL', field: 'properties_type', values: ['AI_AGENT'] },
      }),
      signal,
    })
    if (!res.ok) throw new Error(`The copilot configuration could not be read (${res.status}).`)
    const body = (await res.json()) as {
      response?: { objects?: { properties?: Record<string, string> }[] }
    }
    const id = body.response?.objects?.[0]?.properties?.fetch_conversation_automation
    if (!id) throw new Error('This environment registers no conversation automation.')
    return id
  })()

  // A failed lookup must not poison every later attempt.
  return automationIdPromise.catch((err) => {
    automationIdPromise = null
    throw err
  })
}

/** Every HTML artifact in the conversation, oldest first.
 *
 * Order matters: it is what lets a click on the third file card in the transcript resolve
 * to the third artifact, without depending on the card's markup or its title being unique
 * (agents happily produce two files with the same name). */
export async function fetchConversationArtifacts(
  chatId: string,
  aiAgentId: string,
  signal?: AbortSignal,
): Promise<CaseArtifact[]> {
  const automationId = await fetchConversationAutomationId(signal)

  const res = await fetch(
    `${API_BASE}/api/workflow/execute/node?fetchConversation=${automationId}&copilotType=AI_AGENT`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: API_BASE ? 'include' : 'same-origin',
      body: JSON.stringify({
        context: { appName: 'callables', resourceName: 'callables_call_automation' },
        inputs: {
          automationId,
          synchronous: true,
          parameters: { copilotType: 'AI_AGENT', caseId: chatId, aiAgentId, until: Date.now() },
        },
      }),
      signal,
    },
  )
  if (!res.ok) throw new Error(`The conversation could not be read (${res.status}).`)

  const body = (await res.json()) as { response?: { messages?: ConversationMessage[] } }
  const messages = body.response?.messages ?? []

  // The API answers newest-first; the transcript reads oldest-first, and so must this.
  const ordered = [...messages].sort((a, b) => (a.createdTime ?? 0) - (b.createdTime ?? 0))

  const artifacts: CaseArtifact[] = []
  const seen = new Set<string>()
  for (const message of ordered) {
    const props = message.previewDetails?.canvas?.props
    if (!props || !isHtmlFormat(props)) continue
    const url = props.downloadUrl || props.previewUrl
    if (!url || seen.has(url)) continue
    seen.add(url)
    artifacts.push({ url, fileName: props.fileName })
  }
  return artifacts
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
