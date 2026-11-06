import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { fetchIceConfig } from '../../media/ice'
import type { RoomCode } from '../../room/link'
import { createPeerJs } from '../../room/peerjs'
import { createRoom, type Room, type RoomMedia, type RoomSnapshot } from '../../room/room'

// The capture options come from the core untouched (media/capture.ts): this adapter must never build
// or change them, so Discord's voice cannot leak through system audio.
const browserMedia: RoomMedia = {
  getDisplayMedia: options => navigator.mediaDevices.getDisplayMedia(options as DisplayMediaStreamOptions),
  getUserMedia: constraints => navigator.mediaDevices.getUserMedia(constraints),
}

const canNotify = () => 'Notification' in window && Notification.permission === 'granted'
const noRoom = () => () => {}

/**
 * Opens one room for as long as the component is mounted (bump `attempt` to open it again) and
 * reads its snapshot through useSyncExternalStore. Until the ICE config arrives there is no room
 * yet, and the snapshot reads as connecting.
 */
export function useRoom(code: RoomCode, name: string, away: boolean, attempt: number): { room: Room | null; snapshot: RoomSnapshot } {
  const [room, setRoom] = useState<Room | null>(null)

  useEffect(() => {
    let cancelled = false, current: Room | null = null
    const leave = () => current?.leave()
    void fetchIceConfig().then(iceConfig => {
      if (cancelled) return
      current = createRoom({ code, name, away, iceConfig, canNotify, createPeer: createPeerJs, media: browserMedia })
      setRoom(current)
    })
    addEventListener('pagehide', leave)
    return () => {
      cancelled = true
      removeEventListener('pagehide', leave)
      leave()
      setRoom(null)
    }
    // The name and away state only seed a new room; later changes go through setName and setAway.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [code, attempt])

  const pending = useMemo<RoomSnapshot>(() => ({
    code, status: { kind: 'connecting' }, me: null, name, away, hosting: false, members: [], tiles: new Map(),
    screen: { status: 'off' }, camera: { status: 'off', effect: 'normal' },
  }), [code, name, away])

  const snapshot = useSyncExternalStore(room ? room.subscribe : noRoom, room ? room.getSnapshot : () => pending)
  return { room, snapshot }
}
