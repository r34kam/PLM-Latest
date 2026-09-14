/**
 * Default `data-test-id` values for the pre-built ui primitives.
 *
 * An explicit id at the call site is always better: it says what the thing IS, so it
 * survives a relabel or a translation. But the primitives in `components/ui` ship
 * before any app exists, so nobody has stamped them — and a `<Button>` a test cannot
 * find is a `<Button>` that cannot be clicked. These fall back to an id DERIVED from
 * whatever identifying value the element already carries (`name`, `htmlFor`, `value`,
 * its label text), which is worse than an authored id and far better than none.
 *
 * Every primitive places the fallback BEFORE its `{...props}` spread, so a call-site
 * `data-test-id` overwrites it. That ordering is the whole contract — put it after
 * the spread and the fallback would clobber the author's own id.
 */

import * as React from 'react'

/** Cap so a long label can't turn into an unusable selector. */
const MAX_SLUG = 40

/**
 * `"Save changes"` → `"save-changes"`. Returns "" when nothing usable survives, which
 * is the signal to fall through to the next candidate.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, '')
}

/**
 * The visible text of a React node, when it is text at all. Only strings, numbers and
 * arrays of them — an element child (an icon, a nested component) is deliberately NOT
 * walked: rendering it to find a string is expensive on every render and yields the
 * icon's internals rather than a label.
 */
export function textOf(node: React.ReactNode): string {
  if (typeof node === 'string') return node
  if (typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join(' ')
  return ''
}

/**
 * `testId('button', 'Save changes')` → `"button-save-changes"`. The first candidate
 * that slugifies to something non-empty wins; with none, the bare `prefix` is used so
 * the element is still addressable by kind (`[data-test-id="button"]`).
 *
 * Candidates take `unknown` because they come from loosely-typed props (`value` on a
 * radio item, `name` on an input) where a number or undefined is normal.
 */
export function testId(prefix: string, ...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const text =
      typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate)
        : textOf(candidate as React.ReactNode)
    const slug = slugify(text)
    if (slug) return `${prefix}-${slug}`
  }
  return prefix
}
