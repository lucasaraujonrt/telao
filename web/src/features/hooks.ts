import { useEffect, useEffectEvent, useLayoutEffect, useRef } from 'react'

const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.getAttribute('role') === 'slider')

/**
 * Single-key shortcuts for the room, as in the old app: never while typing or on a slider, never with
 * a modifier, never on key repeat. The handler gets the lowercased key and returns true when it used
 * it, which marks the event handled. `capture` runs it before the room's own keys.
 */
export function useHotkeys(onKey: (key: string) => boolean | void, { enabled = true, capture = false } = {}) {
  const handle = useEffectEvent((event: KeyboardEvent) => {
    if (!enabled || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat || editable(event.target)) return
    if (onKey(event.key.toLowerCase()) === true) event.preventDefault()
  })
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handle(event)
    addEventListener('keydown', listener, { capture })
    return () => removeEventListener('keydown', listener, { capture })
  }, [capture])
}

/** A ref that always holds the latest value, for callbacks handed to long-lived feature objects. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useLayoutEffect(() => { ref.current = value })
  return ref
}
