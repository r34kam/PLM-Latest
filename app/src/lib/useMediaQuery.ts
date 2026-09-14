import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query from React.
 *
 * This is for deciding what to **mount**, which Tailwind cannot do. `hidden md:flex`
 * only decides what is VISIBLE — both branches stay in the tree, still mounted, still
 * running their effects and their data fetching. That is fine for a heading and wrong
 * for anything stateful: two copies of a list inside one provider, two subscriptions,
 * two fetches, or a drawer that traps focus while invisible.
 *
 * Reach for the Tailwind class first. Use this only when the two branches must not both
 * exist.
 *
 * The initial value is read synchronously in a lazy initializer, so the first paint is
 * already correct — no flash of the wrong layout, and no `useEffect` round trip before
 * the right branch appears. `typeof window` keeps it safe where there is no DOM (tests,
 * any prerender).
 *
 * ```tsx
 * const isDesktop = useMediaQuery('(min-width: 1280px)')
 * return isDesktop ? <Sidebar /> : <Drawer />
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const list = window.matchMedia(query)
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches)
    list.addEventListener('change', onChange)
    // Re-read on subscribe: the query can change between renders, and the viewport can
    // change between the lazy initializer and this effect.
    setMatches(list.matches)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tailwind's `md` breakpoint, so a mount decision and a `md:` class agree. Keep these in
 * step: a component that mounts at one width and restyles at another is a layout bug that
 * only appears in a narrow band of viewport sizes. */
export const DESKTOP_QUERY = '(min-width: 768px)'

/** True from Tailwind's `md` up. The common case, named so call sites read as intent
 * rather than as a magic pixel count. */
export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
