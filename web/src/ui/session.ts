import type { RoomCode } from '../room/link'

// A name chosen on the home for the room it is about to open, so the room route joins at once
// instead of asking again. Read once.
let pending: { code: RoomCode; name: string } | null = null

export function joinNext(code: RoomCode, name: string) { pending = { code, name } }

export function takeJoin(code: RoomCode): string | null {
  const name = pending?.code === code ? pending.name : null
  pending = null
  return name
}
