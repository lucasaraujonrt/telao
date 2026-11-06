import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import type { Room, TileKey } from '../../room/room'
import { useHotkeys, useLatest } from '../hooks'
import { AWAY } from '../memes/memes'
import { floatReaction } from './effects'
import { createReactions, REACTS, type Reaction } from './reactions'

/** Keys 1 to 5 or the toolbar send a reaction to the tile under the pointer, else the focused one. */
export function useReactions({ room, away, pickTarget, enabled }: {
  room: Room | null
  away: boolean
  pickTarget: () => TileKey | null
  enabled: boolean
}) {
  const latest = useLatest({ away })

  const reactions = useMemo(() => room && createReactions({ room, isAway: () => latest.current.away, onShow: floatReaction }), [room, latest])
  useEffect(() => reactions?.listen(), [reactions])

  const react = (reaction: Reaction) => {
    if (!reactions) return
    if (away) { toast(AWAY); return }
    const target = pickTarget()
    if (!target) { toast('Ninguém está ao vivo pra reagir.'); return }
    reactions.react(target, reaction)
  }

  useHotkeys(key => {
    const index = '12345'.indexOf(key)
    if (key.length !== 1 || index < 0) return
    react(REACTS[index])
    return true
  }, { enabled })

  return { react, reactions: REACTS }
}
