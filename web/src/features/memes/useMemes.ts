import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { store } from '@/lib/storage'
import type { PeerId } from '../../room/protocol'
import type { Room } from '../../room/room'
import { useHotkeys, useLatest } from '../hooks'
import type { Sounds } from '../sounds'
import { bindKey, HOTKEYS, labelOf, loadBoard, saveBoard, type Board, type Hotkey } from './board'
import type { MemeKey } from './catalog'
import { createMemes } from './memes'

const FLASH_MS = 600
const notCooling = () => false
const noop = () => () => {}

/** The memes board: your own layout of memes, the room-wide player, and the Q/W/E/R keys. */
export function useMemes({ room, sounds, away, nameOf, enabled }: {
  room: Room | null
  sounds: Sounds
  away: boolean
  nameOf: (id: PeerId) => string
  enabled: boolean
}) {
  const [board, setBoardState] = useState<Board>(() => loadBoard(store))
  const [flash, setFlash] = useState<MemeKey | null>(null)
  const hovered = useRef<MemeKey | null>(null)
  const latest = useLatest({ away, nameOf, board })

  const memes = useMemo(() => room && createMemes({
    room, sounds,
    isAway: () => latest.current.away,
    labelOf: key => labelOf(latest.current.board, key),
    nameOf: id => latest.current.nameOf(id),
    notify: text => { toast(text) },
  }), [room, sounds, latest])

  useEffect(() => {
    if (!memes) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const stopFlash = memes.onPlay(key => {
      setFlash(key); clearTimeout(timer)
      timer = setTimeout(() => setFlash(null), FLASH_MS)
    })
    const stop = memes.listen()
    return () => { stop(); stopFlash(); clearTimeout(timer) }
  }, [memes])

  // Away stops anything still playing, as in the old app.
  useEffect(() => { if (away) sounds.hush() }, [away, sounds])

  const cooling = useSyncExternalStore(memes ? memes.subscribe : noop, memes ? memes.cooling : notCooling)
  const setBoard = (next: Board) => { setBoardState(next); saveBoard(store, next) }
  const fire = (key: MemeKey) => memes?.fire(key)

  useHotkeys(key => {
    if (!HOTKEYS.includes(key as Hotkey)) return
    const hotkey = key as Hotkey
    if (hovered.current) {
      const meme = hovered.current
      setBoard(bindKey(board, hotkey, meme))
      toast(`${hotkey.toUpperCase()} agora toca ${labelOf(board, meme) ?? 'esse meme'}`)
    } else if (board.keys[hotkey]) fire(board.keys[hotkey])
    else return
    return true
  }, { enabled })

  return { board, setBoard, fire, cooling, flash, hovered }
}
export type MemesBoard = ReturnType<typeof useMemes>
