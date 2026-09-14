/* Recognising HTML in a copilot reply.
 *
 * These are deliberately pure functions over strings and plain DOM nodes, with no React
 * and no SDK imports, so the rules can be unit tested without mounting a chat.
 *
 * The rules lean on the CONTENT of a block rather than on the class names the SDK happens
 * to put on it. Class names are the SDK's private business and change between versions;
 * a document that starts with `<!doctype html>` is a document in any version. */

/** Selectors that positively identify a fenced ```html block, across the several
 * conventions a markdown renderer might use. Tried in order, then the content sniff
 * below catches anything these miss. */
const HTML_CODE_SELECTORS = [
  'code.language-html',
  'code[class*="language-html"]',
  'code[class*="lang-html"]',
  'code[class*="language-xml"]', // highlight.js labels HTML as xml
  'pre[class*="language-html"] code',
  'pre[data-language="html" i] code',
  '[data-language="html" i]',
  '[data-lang="html" i]',
].join(', ')

/** Does this text look like something a browser could render as a page?
 *
 * Requires a real document or a recognisable structural tag — not merely an angle
 * bracket, or every snippet of JSX, XML or shell redirection in the conversation would
 * open a preview. */
export function looksLikeHtml(text: string): boolean {
  const t = text.trim()
  if (t.length < 20) return false
  return (
    /^<!doctype\s+html/i.test(t) ||
    /^<html[\s>]/i.test(t) ||
    /<html[\s>][\s\S]*<\/html\s*>/i.test(t) ||
    (/<(body|head|main|section|article|table|div|h1|svg)[\s>]/i.test(t) && /<\/\s*[a-z][\w-]*\s*>/i.test(t))
  )
}

/** Is the document finished, or still arriving token by token?
 *
 * Committing a half-streamed document to an iframe makes the browser re-parse an
 * incomplete tree on every frame — it flickers, and the last thing rendered may be a
 * fragment. A reply is only worth previewing once it closes the tag it opened. */
export function isCompleteHtml(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  if (/<html[\s>]/i.test(t)) return /<\/html\s*>/i.test(t)
  if (/<body[\s>]/i.test(t)) return /<\/body\s*>/i.test(t)
  return t.endsWith('>')
}

/** Does this href point at an HTML file we should fetch and preview?
 *
 * The pathname is what decides it, never the whole URL: a signed download link carries
 * the real filename in a query parameter more often than not, and `href.includes('.html')`
 * would also match `?next=/index.html` or a `.htmlx` template. */
export function isHtmlHref(href: string): boolean {
  if (!href) return false
  if (href.startsWith('blob:') || href.startsWith('data:text/html')) return true
  let pathname: string
  let search = ''
  try {
    const url = new URL(href, 'http://localhost')
    pathname = url.pathname
    search = url.search
  } catch {
    pathname = href
  }
  if (/\.html?$/i.test(pathname)) return true
  // Signed URLs commonly park the filename in `filename=` / `response-content-disposition`.
  return /[?&](filename|file_name|name)=[^&]*\.html?(&|$)/i.test(search)
}

/** The last fenced HTML block in the container, or null.
 *
 * "Last" because a conversation accumulates: the user asked for a revision, and the
 * revision is the thing they want to look at. */
export function findHtmlCodeBlock(container: ParentNode): string | null {
  const tagged = Array.from(container.querySelectorAll(HTML_CODE_SELECTORS))
  const sniffed = Array.from(container.querySelectorAll('pre code, pre, code'))
  // Tagged blocks are more trustworthy, so they win when both are present.
  for (const list of [tagged, sniffed]) {
    for (let i = list.length - 1; i >= 0; i--) {
      const text = list[i].textContent ?? ''
      if (looksLikeHtml(text) && isCompleteHtml(text)) return text
    }
  }
  return null
}

/** Every distinct HTML file link in the container, oldest first. */
export function findHtmlLinks(container: ParentNode): string[] {
  const anchors = Array.from(container.querySelectorAll('a[href]')) as HTMLAnchorElement[]
  const seen = new Set<string>()
  const out: string[] = []
  for (const a of anchors) {
    const href = a.href || a.getAttribute('href') || ''
    if (!isHtmlHref(href) || seen.has(href)) continue
    seen.add(href)
    out.push(href)
  }
  return out
}
