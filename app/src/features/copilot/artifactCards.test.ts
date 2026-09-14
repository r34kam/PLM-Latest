import { describe, expect, it } from 'bun:test'
import { cardIndexForClick, findDownloadControls } from './artifactCards'

/* A stand-in for the SDK's file card: nested generic stacks, a title, a Download button,
 * and deliberately NO href and no identifying class — which is what the real markup is. */
function buildTranscript(titles: string[]): HTMLElement {
  const container = document.createElement('div')
  container.innerHTML = titles
    .map(
      (title) => `
      <div data-block-type="Stack">
        <p>some prose from the agent</p>
        <div data-block-type="Stack">
          <div data-block-type="Stack"><span class="t">${title}</span><span>HTML · 48 KB</span></div>
          <button type="button">Download</button>
        </div>
      </div>`,
    )
    .join('')
  return container
}

const titleEl = (container: HTMLElement, index: number) =>
  container.querySelectorAll('.t')[index] as Element

describe('findDownloadControls', () => {
  it('finds one control per card, in transcript order', () => {
    const container = buildTranscript(['A', 'B', 'C'])
    expect(findDownloadControls(container)).toHaveLength(3)
  })

  it('finds nothing in a transcript with no files', () => {
    const container = document.createElement('div')
    container.innerHTML = '<div><p>just a reply</p></div>'
    expect(findDownloadControls(container)).toHaveLength(0)
  })
})

describe('cardIndexForClick', () => {
  it('maps a click on a card title to that card position', () => {
    const container = buildTranscript(['A', 'B', 'C'])
    expect(cardIndexForClick(container, titleEl(container, 0))).toBe(0)
    expect(cardIndexForClick(container, titleEl(container, 1))).toBe(1)
    expect(cardIndexForClick(container, titleEl(container, 2))).toBe(2)
  })

  it('identifies cards by position, so duplicate names stay distinguishable', () => {
    // Agents really do produce two files with the same title — matching on text would
    // collapse these two into one.
    const container = buildTranscript(['IT Issue Dashboard', 'IT Issue Dashboard'])
    expect(cardIndexForClick(container, titleEl(container, 0))).toBe(0)
    expect(cardIndexForClick(container, titleEl(container, 1))).toBe(1)
  })

  it('ignores a click on the download control itself', () => {
    // That click is a download. Opening the preview as well would be a surprise.
    const container = buildTranscript(['A'])
    const download = container.querySelector('button') as Element
    expect(cardIndexForClick(container, download)).toBe(-1)
  })

  it('ignores a click on prose outside any card', () => {
    const container = buildTranscript(['A'])
    const prose = document.createElement('p')
    container.appendChild(prose)
    expect(cardIndexForClick(container, prose)).toBe(-1)
  })

  it('ignores a click on the container itself', () => {
    const container = buildTranscript(['A', 'B'])
    expect(cardIndexForClick(container, container)).toBe(-1)
  })

  it('returns -1 when the transcript has no cards at all', () => {
    const container = document.createElement('div')
    container.innerHTML = '<p>hello</p>'
    expect(cardIndexForClick(container, container.querySelector('p'))).toBe(-1)
  })

  it('handles a null target', () => {
    const container = buildTranscript(['A'])
    expect(cardIndexForClick(container, null)).toBe(-1)
  })
})
