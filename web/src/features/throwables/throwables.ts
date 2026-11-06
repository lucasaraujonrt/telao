import { ITEMS, type Item, type PeerId } from '../../room/protocol'
import type { Room, TileKey } from '../../room/room'
import { ownGate, senderGate } from '../gate'

export { ITEMS, type Item }
export const EMOJI: Record<Item, string> = { tomate: '🍅', ovo: '🥚', chinelo: '🩴' }
export const ITEM_NAMES: Record<Item, string> = { tomate: 'Tomate', ovo: 'Ovo', chinelo: 'Chinelo' }
export const ITEM_KEYS: Record<Item, string> = { tomate: 'Z', ovo: 'X', chinelo: 'C' }
const HIT: Record<Item, string> = { tomate: 'um tomate', ovo: 'um ovo', chinelo: 'uma chinelada' }

export const OWN_GAP_MS = 300
export const SENDER_GAP_MS = 200

export interface ThrowablesOptions {
  room: Pick<Room, 'onMessage' | 'broadcast' | 'toWire' | 'fromWire'>
  isAway: () => boolean
  nameOf: (id: PeerId) => string
  notify: (text: string) => void
  /** Draws the throw on the tile, if it is on screen. x and y are fractions of the tile. */
  onLand: (key: TileKey, item: Item, x: number, y: number) => void
  now?: () => number
}

const mine = (key: TileKey) => key === 'me' || key === 'me:camera'

export function createThrowables(options: ThrowablesOptions) {
  const { room, isAway, nameOf, notify, onLand, now = Date.now } = options
  const own = ownGate(OWN_GAP_MS, now), senders = senderGate(SENDER_GAP_MS, now)

  return {
    /** Throws at a tile, unless you are away or threw less than 300 ms ago. */
    throwAt(key: TileKey, item: Item, x: number, y: number) {
      if (isAway() || !own()) return
      const at = (value: number) => Math.min(1, Math.max(0, value))
      room.broadcast({ t: 'throw', item, target: room.toWire(key), x: at(x), y: at(y) })
      onLand(key, item, at(x), at(y))
    },
    /** Starts landing what the room throws; returns the function that stops. */
    listen: () => room.onMessage('throw', (message, from) => {
      if (isAway() || !senders(from)) return
      const key = room.fromWire(message.target)
      onLand(key, message.item, message.x, message.y)
      if (mine(key)) notify(`${nameOf(from)} te acertou ${HIT[message.item]}`)
    }),
  }
}
export type Throwables = ReturnType<typeof createThrowables>
