/* Working out WHICH file card in the transcript was clicked.
 *
 * The SDK renders a file card as generic no-code blocks — nested `<div data-block-type=
 * "Stack">` wrapping a `Typography` title and a `Download` button. There is no id, no
 * class worth matching, and crucially **no URL anywhere in the markup**: the card knows its
 * file through SDK state, not through an `href`. Verified by inspection, not assumed.
 *
 * So a click is resolved by ORDER, not by identity. The Nth card in the transcript is the
 * Nth artifact in the conversation, and both lists are built oldest-first. The only thing
 * this depends on is "each file card contains exactly one download control", which is what
 * makes a card a card.
 *
 * Pure functions over plain DOM so they can be exercised without mounting a chat.
 */

/** Text of the control that downloads a card's file. Matched on the accessible name rather
 * than a class, because that is the part the SDK is least likely to churn. */
function isDownloadControl(el: Element): boolean {
  const label = (el.getAttribute('aria-label') || el.textContent || '').trim()
  return /^download$/i.test(label)
}

/** Every file card's download control, in transcript order. */
export function findDownloadControls(container: ParentNode): Element[] {
  return Array.from(container.querySelectorAll('button, a')).filter(isDownloadControl)
}

/** Which card does this click belong to, as an index into `findDownloadControls`?
 *
 * Walks up from whatever was clicked until it reaches an ancestor holding exactly one
 * download control — that ancestor is the card. Reaching one that holds several means the
 * walk has left the card and is now inside the message list, so the click was on neither
 * card and nothing should open.
 *
 * Returns -1 when the click was not on a card.
 */
export function cardIndexForClick(container: Element, target: Element | null): number {
  const controls = findDownloadControls(container)
  if (!controls.length) return -1

  // A click ON the download control itself is a download, not a request to preview.
  for (const control of controls) {
    if (control === target || control.contains(target)) return -1
  }

  let node: Element | null = target
  while (node && node !== container) {
    const inside = controls.filter((control) => node!.contains(control))
    if (inside.length === 1) return controls.indexOf(inside[0])
    if (inside.length > 1) return -1
    node = node.parentElement
  }
  return -1
}
