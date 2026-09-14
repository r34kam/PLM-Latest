// Visual select/edit bridge — injected into the code-builder preview ONLY
// (dynamically imported from main.tsx behind import.meta.env.VITE_SELECT_MODE).
// A real deploy build never imports this file.
//
// The parent app (unifyapps/www) owns the UI, persistence, and the highlight
// OVERLAY. This script is a thin slave that does only what the parent can't do
// across the cross-origin iframe boundary:
//   1. hit-test the DOM and report the element under the cursor / clicked,
//   2. apply the parent's style-override map as a <style> layer (CSS can only
//      be injected from inside the document it targets),
//   3. apply the parent's content-override map (pending literal/text edits) to the
//      DOM directly, so a text edit shows instantly without waiting on a rebuild.
//
// Identity: the build stamps every element with data-sel-id="<file>:<line>:<col>"
// — its SOURCE location. A component reused N times therefore renders N nodes
// with the SAME data-sel-id, and that is intentional here: editing one instance
// edits the shared component, so the override applies to ALL instances and the
// overlay highlights ALL of them (so the user sees the full scope of the edit).
//
// All messages are tagged { source: 'ua-sel' } in both directions.

const SOURCE = 'ua-sel'
const STYLE_ID = '__ua_sel_overrides'

// Capabilities THIS bridge build supports, announced on `ready` so the parent can
// negotiate. An OLDER preview build (bundled before a feature existed) omits this
// field entirely; the parent treats a missing cap as unsupported and falls back.
// For `content` that fallback is a source bake + iframe remount — so a stale session
// still lands a text edit instead of silently swallowing the dropped `content` message.
const CAPS = { content: true, locate: true } as const

type OverrideMap = Record<string, Record<string, string>>
// literal/text edits, keyed by the enclosing element's data-sel-id (selId) — the same
// key space as style overrides. The parent already knows the selId (the selected
// element); we edit that element's text node directly, no extra stamp needed.
type ContentMap = Record<string, string>

type InMsg =
  | { source: typeof SOURCE; type: 'enable' }
  | { source: typeof SOURCE; type: 'disable' }
  | { source: typeof SOURCE; type: 'deselect' }
  | { source: typeof SOURCE; type: 'apply'; map: OverrideMap }
  // parent → iframe: apply pending literal/text edits instantly (no rebuild), keyed
  // by the element's data-sel-id. The debounced source rebuild reconciles later.
  | { source: typeof SOURCE; type: 'content'; map: ContentMap }
  // parent → iframe: select / highlight an element by sel-id (e.g. the layers tree
  // or the Position panel's "Relative to" target). The iframe replies with the same
  // `selected` / `highlight` payload a preview interaction produces.
  | { source: typeof SOURCE; type: 'select'; selId: string }
  | { source: typeof SOURCE; type: 'highlight'; selId: string | null }
  // parent → iframe: where are these elements right now? Drives the review-comment
  // pins, which are persisted against a sel-id and have to be placed on every load
  // (and kept placed as the page scrolls). Sending the whole set at once matters:
  // a page can carry dozens of pins, and one round trip per pin would be a
  // postMessage storm on every scroll frame.
  //
  // `null` STOPS tracking; `[]` does not. The empty list is a real state — a page
  // whose pins have all been orphaned by an agent edit has no sel-ids left to
  // resolve, but still needs the page box reported so those pins can be drawn at
  // their stored coordinates.
  | { source: typeof SOURCE; type: 'locate'; selIds: string[] | null }

// computed-style props surfaced to the editor panel as starting values
const COMPUTED_PROPS = [
  'color',
  'background-color',
  'font-size',
  'font-weight',
  'text-align',
  // typography — the Typography panel reads these so its fields start from the
  // element's real values (font, line spacing, decoration, stroke, wrapping…)
  'font-family',
  'line-height',
  'font-style',
  'text-decoration-line',
  'letter-spacing',
  'text-transform',
  'text-indent',
  'text-overflow',
  'text-wrap',
  'white-space',
  'word-break',
  'direction',
  'column-count',
  '-webkit-text-stroke-width',
  '-webkit-text-stroke-color',
  // background — the Backgrounds panel reads the full longhand set (computed
  // styles never return the `background` shorthand)
  'background-image',
  'background-clip',
  'background-position',
  'background-size',
  'background-repeat',
  'background-attachment',
  'padding',
  'margin',
  // longhand padding/margin — the Spacing box reads each side individually
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'border-radius',
  // border — the Border panel reads per-side width/style/color and each corner
  // radius individually (computed styles have no `border` shorthand)
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
  // layout — so the Layout panel pre-populates from the element's current styles
  'display',
  'flex-direction',
  'flex-wrap',
  'justify-content',
  'align-items',
  'align-content',
  'justify-items',
  'gap',
  'column-gap',
  'row-gap',
  'grid-auto-flow',
  'grid-template-columns',
  'grid-template-rows',
]

let enabled = false
let hoverRaf = 0
let lastHoverId: string | null | undefined
// the currently-selected sel-id, so we can re-report its rects when the layout
// shifts (e.g. the editor panel opens and reflows the iframe)
let selectedId: string | null = null
let layoutRaf = 0
// sel-ids the parent is tracking comment pins against, or null when it is tracking
// nothing. Held so the same answer can be re-sent on every layout change — a pin
// that only reported its position once would slide off its element the first time
// the user scrolled.
let locateIds: string[] | null = null

function post(msg: Record<string, unknown>): void {
  window.parent.postMessage({ source: SOURCE, ...msg }, '*')
}

// walk up to the nearest ancestor carrying a data-sel-id
function resolve(target: EventTarget | null): { el: HTMLElement; id: string } | null {
  let cur = target as Element | null
  while (cur && cur !== document.documentElement) {
    const id = cur.getAttribute?.('data-sel-id')
    if (id) return { el: cur as HTMLElement, id }
    cur = cur.parentElement
  }
  return null
}

function rectOf(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

function escapeId(id: string): string {
  return id.replace(/["\\]/g, '\\$&')
}

// every DOM node sharing this sel-id (a reused component renders many) — the
// override applies to all of them, so the overlay boxes all of them
function rectsFor(selId: string): ReturnType<typeof rectOf>[] {
  const nodes = document.querySelectorAll(`[data-sel-id="${escapeId(selId)}"]`)
  return Array.from(nodes, (node: any) => rectOf(node as HTMLElement))
}

function computedOf(el: HTMLElement): Record<string, string> {
  const cs = getComputedStyle(el)
  const out: Record<string, string> = {}
  for (const prop of COMPUTED_PROPS) out[prop] = cs.getPropertyValue(prop)
  return out
}

function onMove(event: MouseEvent): void {
  if (!enabled) return
  if (hoverRaf) return
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0
    const hit = resolve(event.target)
    const id = hit?.id ?? null
    // only chatter when the hovered element changes
    if (id === lastHoverId && id !== null) return
    lastHoverId = id
    if (!hit) {
      post({ type: 'hover', selId: null })
      return
    }
    // hover boxes all instances too, so the shared-component scope is obvious
    // before clicking
    post({
      type: 'hover',
      selId: hit.id,
      rect: rectOf(hit.el),
      rects: rectsFor(hit.id),
      tag: hit.el.tagName.toLowerCase(),
    })
  })
}

// Report an element as the selection (computed styles + rects + containing block).
// Shared by a preview click and a parent-driven `select` message, so both paths
// converge on the same `selected` payload the editor consumes. `extra` carries the
// source-specific hint: a preview click reports `instanceIndex` (WHICH of the reused
// same-selId nodes was clicked, so the editor targets that instance's literal — e.g.
// the Priority column, not the first); a tree-driven `select` reports `viaSelect` so
// the parent keeps its explicit tree pick instead of overriding it by index.
function emitSelected(
  el: HTMLElement,
  selId: string,
  extra: { instanceIndex?: number; viaSelect?: boolean; point?: { x: number; y: number } } = {},
): void {
  selectedId = selId
  post({
    type: 'selected',
    selId,
    tag: el.tagName.toLowerCase(),
    rect: rectOf(el),
    rects: rectsFor(selId),
    computed: computedOf(el),
    containingBlock: containingBlockOf(el),
    // Whether an in-place text edit can apply here: applyContent only mutates the
    // element's single direct text-node child (directTextChild), so a mixed/multi-text
    // element like `Hello {name}!` (two text nodes) can't be edited in place. The parent
    // reads this to route such literals through a bake + rebuild instead of firing a
    // content override the bridge would silently skip (a no-op the user never sees).
    editableInPlace: directTextChild(el) !== null,
    ...extra,
  })
}

// first DOM node carrying this sel-id (a reused component renders many; selection
// computes against the first, while overrides/overlays still apply to all)
function elementForId(selId: string): HTMLElement | null {
  return document.querySelector(`[data-sel-id="${escapeId(selId)}"]`) as HTMLElement | null
}

// every node sharing a sel-id, in document order — the order `instanceIndexOf` counts in
function elementsForId(selId: string): HTMLElement[] {
  return Array.prototype.slice.call(
    document.querySelectorAll(`[data-sel-id="${escapeId(selId)}"]`),
  ) as HTMLElement[]
}

// index of `el` among all DOM nodes sharing its sel-id (document order), so the parent
// can map the CLICKED instance to the matching literal in the layers tree. 0 when unique.
function instanceIndexOf(el: HTMLElement, selId: string): number {
  const nodes = document.querySelectorAll(`[data-sel-id="${escapeId(selId)}"]`)
  return Math.max(0, Array.prototype.indexOf.call(nodes, el))
}

function onClick(event: MouseEvent): void {
  if (!enabled) return
  const hit = resolve(event.target)
  if (!hit) return
  // swallow the click so the app's own handlers don't fire while editing
  event.preventDefault()
  event.stopPropagation()
  emitSelected(hit.el, hit.id, {
    instanceIndex: instanceIndexOf(hit.el, hit.id),
    // Where the user actually clicked, in the same viewport space as every rect we
    // report — so the parent can drop a comment pin under the cursor instead of at the
    // element's corner. Absent when the selection came from `select` (a layers-tree
    // pick), which has no cursor behind it.
    point: { x: event.clientX, y: event.clientY },
  })
}

// The element's containing block (what `position: absolute` resolves against):
// `offsetParent` is exactly the nearest positioned ancestor (or <body>). null means
// no offset parent (fixed/hidden) → the viewport. We also surface the nearest
// ancestor carrying a data-sel-id so the panel can highlight it on click.
function containingBlockOf(el: HTMLElement): { label: string; selId: string | null } {
  const parent = el.offsetParent as HTMLElement | null
  if (!parent) return { label: 'Viewport', selId: null }

  let cur: Element | null = parent
  let selId: string | null = null
  while (cur && cur !== document.documentElement) {
    const id = cur.getAttribute?.('data-sel-id')
    if (id) {
      selId = id
      break
    }
    cur = cur.parentElement
  }

  const label = parent === document.body ? 'Body' : parent.tagName.toLowerCase()
  return { label, selId }
}

// The page box comment pins are placed against.
//
// `width`/`height` are the SCROLLABLE document, not the viewport, because a pin's
// stored position is a fraction of the whole page — anchoring it to the viewport
// would move every pin whenever the preview pane was resized. `scrollX`/`scrollY`
// are what the parent subtracts to turn that fraction back into a viewport
// position, so the two travel together and are always read in the same frame.
function pageBox() {
  const doc = document.documentElement
  return {
    width: Math.max(doc.scrollWidth, doc.clientWidth),
    height: Math.max(doc.scrollHeight, doc.clientHeight),
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  }
}

// Where each tracked pin's element is now. A sel-id the page no longer has is simply
// absent from `hits` — that is the signal the parent falls back to stored
// coordinates on, and it is the common case after an agent turn rewrites the file.
//
// EVERY instance is reported, in document order, not just the first. A sel-id is
// `file:line:col`, so one line of source that renders in a loop gives every one of
// those nodes the SAME id — a calculator's nineteen buttons are all one sel-id. The
// pin records which instance it was left on (`anchor.instance`, from the same
// `instanceIndex` the editor uses to target the right literal) and picks its rect out
// of this list. Reporting only `querySelector`'s first match drew every one of those
// pins on the first button.
function postLocated(): void {
  const hits: Record<string, ReturnType<typeof rectOf>[]> = {}
  for (const selId of locateIds ?? []) {
    const nodes = elementsForId(selId)
    if (nodes.length) hits[selId] = nodes.map(rectOf)
  }
  post({ type: 'located', hits, page: pageBox() })
}

// the editor panel opening reflows the iframe (and content can scroll), moving
// the selected element(s) — re-report their rects so the overlay tracks them.
function onLayoutChange(): void {
  if (layoutRaf) return
  if (!selectedId && !locateIds) return
  layoutRaf = requestAnimationFrame(() => {
    layoutRaf = 0
    if (selectedId) post({ type: 'selrects', selId: selectedId, rects: rectsFor(selectedId) })
    if (locateIds) postLocated()
  })
}

function styleEl(): HTMLStyleElement {
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = STYLE_ID
    document.head.appendChild(el)
  }
  return el
}

function applyOverrides(map: OverrideMap): void {
  const rules: string[] = []
  for (const [selId, props] of Object.entries(map)) {
    const body = Object.entries(props)
      .filter(([, value]: any) => value != null && value !== '')
      .map(([prop, value]: any) => `${prop}:${value} !important`)
      .join(';')
    if (body) rules.push(`[data-sel-id="${escapeId(selId)}"]{${body}}`)
  }
  styleEl().textContent = rules.join('\n')
}

// text nodes we've overridden → their ORIGINAL (built) value. Lets a later apply that
// DROPS a key restore that node instead of leaving a stale (e.g. an uncommitted live-
// preview) value behind — the same "full rewrite" completeness the style <style> layer
// gets for free. Keyed by the Text node (not its element) so a mixed-content element
// (text beside an icon) restores the right child.
const contentOriginals = new Map<Text, string>()

// The element's SINGLE direct text-node child, or null if it has none or more than one.
// "Exactly one" (not "sole child") is deliberate: it edits a heading whose only child is
// text AND an icon button like `<button>{label}<Icon/></button>` (one text node beside
// element children — the common map-expanded header/link shape), while refusing
// genuinely ambiguous inline text like `Hello {name}!` (two text nodes, no single
// target), which is left for the source rebuild.
function directTextChild(el: Element): Text | null {
  let found: Text | null = null
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (found) return null
      found = child as Text
    }
  }
  return found
}

// Apply literal/text edits directly to the DOM — the no-rebuild counterpart to
// applyOverrides. Each key is an element's data-sel-id (a reused component renders it N
// times, so we edit every instance, matching the shared-component semantics of style
// overrides); a `<selId>#<index>` key targets one instance of a shared selId. We mutate
// the element's single direct text-node child (see directTextChild); the map is
// authoritative — any text node previously overridden but absent now is restored.
function applyContent(map: ContentMap): void {
  const covered = new Set<Text>()
  for (const [key, value] of Object.entries(map)) {
    // A key targets EITHER every instance of a selId (plain `<selId>`, reused-component
    // semantics) OR one instance of a shared selId (`<selId>#<index>` — map-expanded
    // columns share one selId, so the index picks the single column being edited).
    let selId = key
    let only = -1
    const hash = key.lastIndexOf('#')
    if (hash !== -1 && /^\d+$/.test(key.slice(hash + 1))) {
      selId = key.slice(0, hash)
      only = Number(key.slice(hash + 1))
    }
    const nodes = document.querySelectorAll(`[data-sel-id="${escapeId(selId)}"]`)
    nodes.forEach((node: any, i: any) => {
      if (only !== -1 && i !== only) return
      const text = directTextChild(node)
      if (text) {
        if (!contentOriginals.has(text)) contentOriginals.set(text, text.nodeValue ?? '')
        text.nodeValue = value
        covered.add(text)
      }
    })
  }
  for (const [text, original] of contentOriginals) {
    if (!covered.has(text)) {
      text.nodeValue = original
      contentOriginals.delete(text)
    }
  }
}

function setEnabled(next: boolean): void {
  enabled = next
  document.body.style.cursor = next ? 'crosshair' : ''
  if (!next) {
    lastHoverId = undefined
    selectedId = null
    post({ type: 'hover', selId: null })
  }
}

function onMessage(event: MessageEvent): void {
  const data = event.data as InMsg | undefined
  if (!data || data.source !== SOURCE) return
  switch (data.type) {
    case 'enable':
      setEnabled(true)
      break
    case 'disable':
      setEnabled(false)
      break
    case 'deselect':
      selectedId = null
      break
    case 'apply':
      applyOverrides(data.map ?? {})
      // an override can change the selected element's geometry (padding, font
      // size, …) without firing resize/scroll — refresh its overlay rects
      onLayoutChange()
      break
    case 'content':
      applyContent(data.map ?? {})
      // a text change reflows the element (and its neighbors) — refresh overlay rects
      onLayoutChange()
      break
    case 'select': {
      const el = elementForId(data.selId)
      if (el) emitSelected(el, data.selId, { viaSelect: true })
      break
    }
    case 'highlight': {
      const el = data.selId ? elementForId(data.selId) : null
      // selId null (or not found) clears the parent's highlight overlay
      post(
        el && data.selId
          ? { type: 'highlight', selId: data.selId, tag: el.tagName.toLowerCase(), rects: rectsFor(data.selId) }
          : { type: 'highlight', selId: null },
      )
      break
    }
    case 'locate':
      locateIds = Array.isArray(data.selIds) ? data.selIds : null
      // answer immediately as well as on the next layout change: a page that never
      // scrolls or reflows would otherwise leave every pin unplaced
      if (locateIds) postLocated()
      break
  }
}

export function initSelectionBridge(): void {
  window.addEventListener('message', onMessage)
  window.addEventListener('mousemove', onMove, true)
  window.addEventListener('click', onClick, true)
  // panel open/close resizes the iframe; content can also scroll — keep the
  // selected element(s)' overlay rects in sync with both. A ResizeObserver on
  // the document is the reliable signal: the window `resize` event does NOT fire
  // when the iframe ELEMENT is resized by the parent (e.g. the editor panel
  // opening and reflowing the preview), which left the overlay stale.
  new ResizeObserver(onLayoutChange).observe(document.documentElement)
  window.addEventListener('resize', onLayoutChange)
  window.addEventListener('scroll', onLayoutChange, true)
  // announce to the parent so it can (re)send the persisted style-override AND
  // content-override maps — every preview rebuild reloads the iframe and re-runs
  // this, so replaying both is what keeps a just-edited literal from flashing back
  // to its pre-edit text before the debounced source rebuild lands. `caps` lets the
  // parent detect a stale build (which omits it) and fall back accordingly.
  post({ type: 'ready', caps: CAPS })
}
