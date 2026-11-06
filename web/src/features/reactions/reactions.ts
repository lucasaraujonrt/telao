import { REACTS, type Reaction } from '../../room/protocol'
import type { Room, TileKey } from '../../room/room'
import { ownGate, senderGate } from '../gate'

export { REACTS, type Reaction }

export const OWN_GAP_MS = 120
export const SENDER_GAP_MS = 80

export interface ReactionsOptions {
  room: Pick<Room, 'onMessage' | 'broadcast' | 'toWire' | 'fromWire'>
  isAway: () => boolean
  /** Floats the emoji up the tile, if it is on screen. */
  onShow: (key: TileKey, reaction: Reaction) => void
  now?: () => number
}

export function createReactions(options: ReactionsOptions) {
  const { room, isAway, onShow, now = Date.now } = options
  const own = ownGate(OWN_GAP_MS, now), senders = senderGate(SENDER_GAP_MS, now)

  const unsubscribe = room.onMessage('react', (message, from) => {
    if (isAway() || !senders(from)) return
    onShow(room.fromWire(message.target), message.e)
  })

  return {
    react(key: TileKey, reaction: Reaction) {
      if (isAway() || !own()) return
      room.broadcast({ t: 'react', e: reaction, target: room.toWire(key) })
      onShow(key, reaction)
    },
    dispose: unsubscribe,
  }
}
export type Reactions = ReturnType<typeof createReactions>
