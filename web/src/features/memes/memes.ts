import { browserTimers, type TimerHandle, type Timers } from '../../media/timers'
import type { PeerId } from '../../room/protocol'
import type { Room } from '../../room/room'
import { senderGate } from '../gate'
import type { Sounds } from '../sounds'
import { memeUrl, validKey, type MemeKey } from './catalog'

export const COOLDOWN_MS = 1500
/** A sender gets at most one meme a second; the rest are dropped. */
export const SENDER_GAP_MS = 1000
export const AWAY = 'Você está no modo ausente.'

export interface MemesOptions {
  room: Pick<Room, 'onMessage' | 'broadcast'>
  sounds: Pick<Sounds, 'play'>
  isAway: () => boolean
  labelOf: (key: MemeKey) => string | undefined
  nameOf: (id: PeerId) => string
  notify: (text: string) => void
  now?: () => number
  timers?: Timers
}

export interface Memes {
  /** True for 1.5 s after you play one: the board is disabled meanwhile. */
  cooling(): boolean
  subscribe(listener: () => void): () => void
  /** Called with each meme that plays, yours or someone else's, so its button can flash. */
  onPlay(listener: (key: MemeKey) => void): () => void
  fire(key: MemeKey): void
  dispose(): void
}

export function createMemes(options: MemesOptions): Memes {
  const { room, sounds, isAway, labelOf, nameOf, notify, now = Date.now, timers = browserTimers } = options
  const senders = senderGate(SENDER_GAP_MS, now)
  const listeners = new Set<() => void>(), playListeners = new Set<(key: MemeKey) => void>()
  let cooling = false, cooldown: TimerHandle | undefined

  function play(key: MemeKey, from: PeerId | 'me', label?: string) {
    if (isAway() || !validKey(key) || !senders(from)) return
    sounds.play(memeUrl(key))
    playListeners.forEach(listener => listener(key))
    notify(`${from === 'me' ? 'Você' : nameOf(from)}: ${labelOf(key) ?? label ?? 'meme'}`)
  }
  const unsubscribe = room.onMessage('meme', (message, from) => play(message.k, from, message.label))

  const setCooling = (next: boolean) => { cooling = next; listeners.forEach(listener => listener()) }

  return {
    cooling: () => cooling,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    onPlay(listener) { playListeners.add(listener); return () => { playListeners.delete(listener) } },
    fire(key) {
      if (isAway()) { notify(AWAY); return }
      if (cooling || !validKey(key)) return
      setCooling(true)
      cooldown = timers.setTimeout(() => setCooling(false), COOLDOWN_MS)
      const label = labelOf(key)
      room.broadcast(label ? { t: 'meme', k: key, label } : { t: 'meme', k: key })
      play(key, 'me')
    },
    dispose() {
      unsubscribe()
      if (cooldown !== undefined) timers.clearTimeout(cooldown)
      listeners.clear(); playListeners.clear()
    },
  }
}
