import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from 'react'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => {
      const list = matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    () => matchMedia(query).matches,
  )
}

export const useNarrow = () => useMediaQuery('(max-width: 767px)')
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

/** The home follows the system; the room is always dark because it frames video. */
export function useColorScheme(mode: 'system' | 'dark'): 'light' | 'dark' {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  const dark = mode === 'dark' || systemDark
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  return dark ? 'dark' : 'light'
}

function measure(root: HTMLElement) {
  const rects = new Map<string, DOMRect>()
  root.querySelectorAll<HTMLElement>('[data-flip]').forEach(node => rects.set(node.dataset.flip!, node.getBoundingClientRect()))
  return rects
}

const MOVE = { duration: 240, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' }

/**
 * FLIP for children marked `data-flip="<key>"`: when `arrangement` changes (a tile joins or leaves,
 * the focus moves), anything that moved animates from its old box to its new one, and a newcomer
 * fades in at its place. `data-lights` on a newcomer gives it the lights-on entrance instead. Nothing
 * animates on the first render, after a window resize, or while the arrangement holds, so dragging a
 * divider never animates. Call the returned function once a drag ends to take a fresh measure.
 */
export function useFlip(container: RefObject<HTMLElement | null>, arrangement: string) {
  const rects = useRef<Map<string, DOMRect> | null>(null)
  const viewport = useRef('')
  const arranged = useRef(arrangement)

  useLayoutEffect(() => {
    const root = container.current
    if (!root) return
    const previous = rects.current
    const next = measure(root)
    rects.current = next
    // A window resize re-lays everything out at once; that is not a change to animate.
    const size = `${innerWidth}x${innerHeight}`
    const resized = size !== viewport.current
    viewport.current = size
    const rearranged = arrangement !== arranged.current
    arranged.current = arrangement
    if (!previous || resized || !rearranged || reducedMotion()) return
    root.querySelectorAll<HTMLElement>('[data-flip]').forEach(node => {
      const key = node.dataset.flip!, rect = next.get(key)!, before = previous.get(key)
      if (!before) {
        if (node.dataset.lights !== undefined) {
          node.animate([{ opacity: 0, transform: 'scale(0.96)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', delay: 120, fill: 'backwards' })
        } else {
          node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' })
        }
        return
      }
      const dx = before.left - rect.left, dy = before.top - rect.top
      const sx = rect.width ? before.width / rect.width : 1, sy = rect.height ? before.height / rect.height : 1
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return
      node.animate([
        { transformOrigin: 'top left', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
        { transformOrigin: 'top left', transform: 'none' },
      ], MOVE)
    })
  })

  // A resize moves everything at once; take a fresh measure so it does not animate later.
  useEffect(() => {
    const root = container.current
    if (!root) return
    const observer = new ResizeObserver(() => { rects.current = measure(root) })
    observer.observe(root)
    return () => observer.disconnect()
  }, [container])

  return useCallback(() => { if (container.current) rects.current = measure(container.current) }, [container])
}
