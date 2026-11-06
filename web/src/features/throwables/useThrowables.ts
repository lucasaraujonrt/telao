import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { toast } from 'sonner'
import type { PeerId } from '../../room/protocol'
import type { Room } from '../../room/room'
import { useHotkeys, useLatest } from '../hooks'
import type { Sounds } from '../sounds'
import { landThrow } from './effects'
import { createThrowables, ITEMS, type Item } from './throwables'

const KEYS: Record<string, Item> = { z: 'tomate', x: 'ovo', c: 'chinelo' }
const CONTROL = 'button, a, input, [role="slider"]'

/**
 * Arm an item (Z, X, C or the toolbar), then click a tile to throw it at that point. While armed,
 * a click on a tile throws instead of focusing it, and Esc disarms before anything else.
 */
export function useThrowables({ room, sounds, away, nameOf, hasTiles, enabled }: {
  room: Room | null
  sounds: Sounds
  away: boolean
  nameOf: (id: PeerId) => string
  hasTiles: boolean
  enabled: boolean
}) {
  const [armed, setArmed] = useState<Item | null>(null)
  const latest = useLatest({ away, nameOf })

  const throwables = useMemo(() => room && createThrowables({
    room,
    isAway: () => latest.current.away,
    nameOf: id => latest.current.nameOf(id),
    notify: text => { toast(text) },
    onLand: (key, item, x, y) => landThrow(key, item, x, y, sounds.volume),
  }), [room, sounds, latest])
  useEffect(() => throwables?.listen(), [throwables])

  const current = away || !hasTiles ? null : armed
  const arm = (item: Item | null) => {
    if (item && !hasTiles) { toast('Ninguém está ao vivo pra levar.'); return }
    setArmed(previous => previous === item ? null : item)
  }

  useHotkeys(key => {
    if (key === 'escape' && current) { setArmed(null); return true }
    if (away || !(key in KEYS)) return
    arm(KEYS[key])
    return true
  }, { enabled, capture: true })

  const tileAt = (event: MouseEvent) => {
    const target = event.target as HTMLElement
    const tile = target.closest<HTMLElement>('[data-tile-key]')
    if (!tile) return null
    // The tile's own buttons keep working while armed.
    const control = target.closest(CONTROL)
    return control && tile.contains(control) ? null : tile
  }

  return {
    armed: current,
    arm,
    items: ITEMS,
    /** Spread on the room root, so the click is caught before the stage's focus and fullscreen. */
    handlers: {
      onClickCapture(event: MouseEvent) {
        if (!current || !throwables) return
        const tile = tileAt(event)
        if (!tile) return
        event.stopPropagation(); event.preventDefault()
        const rect = (tile.querySelector(':scope > [data-fx]') ?? tile).getBoundingClientRect()
        throwables.throwAt(tile.dataset.tileKey!, current, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
      },
      onDoubleClickCapture(event: MouseEvent) {
        if (current && tileAt(event)) event.stopPropagation()
      },
    },
  }
}
