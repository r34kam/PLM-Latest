import { describe, expect, test } from 'bun:test'

import { isCompleteHtml, isHtmlHref, looksLikeHtml } from './htmlDetection'

describe('looksLikeHtml', () => {
  test('accepts a real document', () => {
    expect(looksLikeHtml('<!doctype html><html><body>Hi there everyone</body></html>')).toBe(true)
    expect(looksLikeHtml('<html lang="en"><body><h1>Report</h1></body></html>')).toBe(true)
  })

  test('accepts a fragment with structure', () => {
    expect(looksLikeHtml('<table><tr><td>ECO-011420</td></tr></table>')).toBe(true)
  })

  test('rejects things that merely contain angle brackets', () => {
    expect(looksLikeHtml('a < b && c > d, which is the whole condition')).toBe(false)
    expect(looksLikeHtml('SELECT * FROM ecos WHERE items > 10 AND stage < 3')).toBe(false)
  })

  test('rejects anything too short to be a page', () => {
    expect(looksLikeHtml('<html>')).toBe(false)
    expect(looksLikeHtml('')).toBe(false)
  })
})

describe('isCompleteHtml', () => {
  test('a document is complete only once it closes', () => {
    expect(isCompleteHtml('<html><body><p>done</p></body></html>')).toBe(true)
    expect(isCompleteHtml('<html><body><p>still streaming')).toBe(false)
  })

  test('a body without a closing body tag is still mid-stream', () => {
    expect(isCompleteHtml('<body><div>partial')).toBe(false)
    expect(isCompleteHtml('<body><div>whole</div></body>')).toBe(true)
  })

  test('a bare fragment counts once it ends on a closed tag', () => {
    expect(isCompleteHtml('<div>hello</div>')).toBe(true)
    expect(isCompleteHtml('<div>hel')).toBe(false)
  })
})

describe('isHtmlHref', () => {
  test('matches a plain html path', () => {
    expect(isHtmlHref('https://files.example.com/reports/eco-summary.html')).toBe(true)
    expect(isHtmlHref('/api/files/abc.htm')).toBe(true)
  })

  test('matches a signed URL that carries the filename in the query', () => {
    expect(isHtmlHref('https://s3.example.com/x/y?filename=eco-summary.html&sig=abc')).toBe(true)
  })

  test('matches blob and data documents the SDK may hand back', () => {
    expect(isHtmlHref('blob:https://app.example.com/9f2c-4b1a')).toBe(true)
    expect(isHtmlHref('data:text/html;base64,PGh0bWw+')).toBe(true)
  })

  test('does not match a path that merely mentions html', () => {
    // The old rule was `href.includes('.html')`, which matched both of these.
    expect(isHtmlHref('https://app.example.com/login?next=/index.html')).toBe(false)
    expect(isHtmlHref('https://files.example.com/template.htmlx')).toBe(false)
  })

  test('ignores an empty href', () => {
    expect(isHtmlHref('')).toBe(false)
  })
})
