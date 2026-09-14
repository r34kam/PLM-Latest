import { test, expect } from 'bun:test'
import { andFilter, extractPage, extractRecord, extractRecords } from './bindings'

const envelope = (objects: unknown[], extra: Record<string, unknown> = {}) => ({
  lookupReferences: {},
  id: 'e_node',
  response: { objects, total: objects.length, hasMore: false, ...extra },
})

test('extractPage reads the execute-node envelope', () => {
  const page = extractPage<{ id: string }>(envelope([{ id: 'a' }, { id: 'b' }], { total: 7, hasMore: true }))
  expect(page.records).toEqual([{ id: 'a' }, { id: 'b' }])
  expect(page.total).toBe(7)
  expect(page.hasMore).toBe(true)
})

// The `useData` result is ALREADY the records array. A wrapper that extracts a second
// time used to throw here on the first row that arrived — uncaught, blanking the page
// on a green build. An array is a shape we recognise, so it passes through.
test('extractPage passes an already-extracted array through', () => {
  const page = extractPage<{ id: string }>([{ id: 'a' }, { id: 'b' }])
  expect(page.records).toEqual([{ id: 'a' }, { id: 'b' }])
  expect(page.total).toBe(2)
  expect(page.hasMore).toBe(false)
})

test('extractRecords is idempotent', () => {
  const once = extractRecords<{ id: string }>(envelope([{ id: 'a' }]))
  expect(extractRecords<{ id: string }>(once)).toEqual([{ id: 'a' }])
})

test('extractRecord takes a SINGLE-fetch response, a list, or a bare record', () => {
  expect(extractRecord<{ id: string }>({ id: 'e_node', response: { id: 'a', properties: {} } })).toEqual({
    id: 'a',
    properties: {},
  })
  expect(extractRecord<{ id: string }>(envelope([{ id: 'a' }, { id: 'b' }]))).toEqual({ id: 'a' })
  expect(extractRecord<{ id: string }>([{ id: 'a' }])).toEqual({ id: 'a' })
  expect(extractRecord<{ id: string }>({ id: 'a' })).toEqual({ id: 'a' })
})

// Loud, not empty: an unrecognised shape must not render as "no records".
test('extractPage still throws on a shape it does not recognise', () => {
  expect(() => extractPage({ response: { rows: [] } })).toThrow('no response.objects')
  expect(() => extractPage(undefined)).toThrow('no response.objects')
  expect(() => extractPage({})).toThrow('no response.objects')
})

test('andFilter returns {} for no leaves', () => {
  expect(andFilter([])).toEqual({})
  expect(andFilter([{ property: 'properties.status', filter: { operator: 'EQUAL', value: 'open' } }])).toEqual({
    operator: 'AND',
    filters: [{ property: 'properties.status', filter: { operator: 'EQUAL', value: 'open' } }],
  })
})
