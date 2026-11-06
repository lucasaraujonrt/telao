import type { PeerId } from '../room/protocol'

/** Drops a sender's messages that arrive closer together than `gap` ms. Your own are never dropped. */
export function senderGate(gap: number, now: () => number) {
  const last = new Map<PeerId, number>()
  return (from: PeerId | 'me') => {
    if (from === 'me') return true
    const at = now()
    if (at - (last.get(from) ?? -Infinity) < gap) return false
    last.set(from, at)
    return true
  }
}

/** Lets one of your own actions through every `gap` ms. */
export function ownGate(gap: number, now: () => number) {
  let last = -Infinity
  return () => {
    const at = now()
    if (at - last < gap) return false
    last = at
    return true
  }
}
