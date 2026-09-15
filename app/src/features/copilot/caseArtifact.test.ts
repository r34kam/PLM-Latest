import { afterEach, describe, expect, it } from 'bun:test'
import { fetchArtifactHtml, fetchCaseArtifact } from './caseArtifact'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

/** Replace `fetch` with one that answers every call the same way. */
function stubFetch(answer: { ok?: boolean; status?: number; statusText?: string; body?: unknown; text?: string }) {
  const calls: { url: string; init?: RequestInit }[] = []
  globalThis.fetch = ((url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return Promise.resolve({
      ok: answer.ok ?? true,
      status: answer.status ?? 200,
      statusText: answer.statusText ?? 'OK',
      json: () => Promise.resolve(answer.body),
      text: () => Promise.resolve(answer.text ?? ''),
    } as Response)
  }) as typeof fetch
  return calls
}

/** The slice of `service_hub_case` the artifact pointer lives in. */
function caseBody(chatId: string, props: Record<string, unknown> | null) {
  return {
    response: {
      objects: {
        [chatId]: {
          properties: {
            additional: props ? { lastPreviewDetails: { canvas: { props } } } : {},
          },
        },
      },
    },
  }
}

describe('fetchCaseArtifact', () => {
  it('reads downloadUrl and fileName off the conversation record', async () => {
    stubFetch({
      body: caseBody('chat-1', {
        downloadUrl: '/api/file/download/ENCRYPTED',
        fileName: 'IT-Issue-Report.html',
      }),
    })

    expect(await fetchCaseArtifact('chat-1')).toEqual({
      url: '/api/file/download/ENCRYPTED',
      fileName: 'IT-Issue-Report.html',
    })
  })

  it('looks the record up by chat id', async () => {
    const calls = stubFetch({ body: caseBody('chat-9', { downloadUrl: '/x' }) })
    await fetchCaseArtifact('chat-9')

    expect(calls[0].url).toContain('/api/lookup')
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      lookupType: 'ENTITY_ID:service_hub_case',
      keys: ['chat-9'],
      type: 'ByKeys',
    })
  })

  it('prefers downloadUrl when both URLs are present', async () => {
    stubFetch({ body: caseBody('c', { downloadUrl: '/download', previewUrl: '/preview' }) })
    expect((await fetchCaseArtifact('c'))?.url).toBe('/download')
  })

  it('falls back to previewUrl when downloadUrl is absent', async () => {
    stubFetch({ body: caseBody('c', { previewUrl: '/preview' }) })
    expect((await fetchCaseArtifact('c'))?.url).toBe('/preview')
  })

  it('returns null for a conversation with no artifact yet', async () => {
    stubFetch({ body: caseBody('c', null) })
    expect(await fetchCaseArtifact('c')).toBeNull()
  })

  it('returns null when the pointer carries no usable URL', async () => {
    stubFetch({ body: caseBody('c', { fileName: 'report.html' }) })
    expect(await fetchCaseArtifact('c')).toBeNull()
  })

  it('returns null when the record does not exist', async () => {
    stubFetch({ body: { response: { objects: {} } } })
    expect(await fetchCaseArtifact('missing')).toBeNull()
  })

  it('throws, rather than returning null, when the lookup itself fails', async () => {
    stubFetch({ ok: false, status: 403, statusText: 'Forbidden' })
    // A 403 is not "no artifact" — conflating the two is what makes an auth failure look
    // like an agent that never produced a file.
    await expect(fetchCaseArtifact('c')).rejects.toThrow('could not be read (403)')
  })
})

describe('fetchArtifactHtml', () => {
  it('returns the markup', async () => {
    stubFetch({ text: '<!doctype html><html><body>hi</body></html>' })
    expect(await fetchArtifactHtml('/api/file/download/X')).toContain('<body>hi</body>')
  })

  it('sends credentials so the session-authenticated file URL resolves', async () => {
    const calls = stubFetch({ text: '<html></html>' })
    await fetchArtifactHtml('/api/file/download/X')
    expect(calls[0].init?.credentials).toBeDefined()
  })

  it('reports the status instead of rendering an error page as a document', async () => {
    stubFetch({ ok: false, status: 401, statusText: 'Unauthorized' })
    await expect(fetchArtifactHtml('/x')).rejects.toThrow('401 Unauthorized')
  })

  it('treats an empty body as a failure, not as an empty preview', async () => {
    stubFetch({ text: '   ' })
    await expect(fetchArtifactHtml('/x')).rejects.toThrow('came back empty')
  })
})
