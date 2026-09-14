import { describe, expect, test } from 'bun:test'

import { slugify, testId, textOf } from './testId'

describe('slugify', () => {
  test('turns a label into a selector-safe slug', () => {
    expect(slugify('Save changes')).toBe('save-changes')
    expect(slugify('Add New Task!')).toBe('add-new-task')
  })

  test('collapses runs and trims the edges, so no id ends in a dash', () => {
    expect(slugify('  Sign   in  ')).toBe('sign-in')
    expect(slugify('email@example.com')).toBe('email-example-com')
  })

  test('caps length without leaving a trailing dash at the cut', () => {
    const slug = slugify('a'.repeat(38) + ' bcd')
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
  })

  test('returns "" when nothing usable survives — the fall-through signal', () => {
    expect(slugify('!!!')).toBe('')
    expect(slugify('')).toBe('')
  })
})

describe('textOf', () => {
  test('reads strings and numbers', () => {
    expect(textOf('Delete')).toBe('Delete')
    expect(textOf(42)).toBe('42')
  })

  test('joins an array of text children', () => {
    expect(textOf(['Save', ' ', 'changes'])).toBe('Save   changes')
  })

  test('does NOT walk an element child', () => {
    // deliberate: rendering one to find a string costs on every render and yields
    // the icon's internals, not a label
    expect(textOf({ type: 'svg', props: {} } as never)).toBe('')
    expect(textOf(null)).toBe('')
    expect(textOf(undefined)).toBe('')
  })
})

describe('testId', () => {
  test('prefixes the first usable candidate', () => {
    expect(testId('button', 'Save changes')).toBe('button-save-changes')
    expect(testId('input', 'email')).toBe('input-email')
  })

  test('falls through candidates in order until one slugifies', () => {
    expect(testId('input', undefined, null, '', 'Your email')).toBe('input-your-email')
    // a name beats the placeholder behind it — the earlier candidate is the stabler one
    expect(testId('input', 'email', 'you@example.com')).toBe('input-email')
  })

  test('accepts numbers, which is what a radio value often is', () => {
    expect(testId('radio', 0)).toBe('radio-0')
    expect(testId('select-item', 12)).toBe('select-item-12')
  })

  test('degrades to the bare prefix, so the element stays addressable by kind', () => {
    expect(testId('button')).toBe('button')
    expect(testId('button', undefined, '!!!')).toBe('button')
  })

  test('reads text children through textOf', () => {
    expect(testId('button', ['Add', ' ', 'task'])).toBe('button-add-task')
  })
})
