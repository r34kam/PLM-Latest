import { test, expect } from 'bun:test'
import { useData } from './data'

test('useData seed returns the inline list data', () => {
  const r = useData<Array<{ id: string }>>('products', 'seed', [{ id: 'p1' }, { id: 'p2' }])
  expect(r.data).toEqual([{ id: 'p1' }, { id: 'p2' }])
  expect(r.loading).toBe(false)
  expect(r.error).toBeUndefined()
  expect(typeof r.refetch).toBe('function')
})

test('useData seed returns inline scalar data', () => {
  const r = useData<{ total: number }>('summary', 'seed', { total: 7 })
  expect(r.data).toEqual({ total: 7 })
})

test('useData returns undefined data for not-yet-supported kinds', () => {
  // 'storage' is implemented now (it runs the FETCH dataSource binding and therefore
  // uses React hooks, so it can only be called from a component). 'callable' is still
  // a declaration the panel reads and the runtime ignores.
  const r = useData('runReport', 'callable', { id: 'e_x' })
  expect(r.data).toBeUndefined()
  expect(r.loading).toBe(false)
})
