declare const roomCodeBrand: unique symbol
export type RoomCode = string & { readonly [roomCodeBrand]: true }

export type RoomLink =
  | { kind: 'none' }
  | { kind: 'invalid' }
  | { kind: 'room'; code: RoomCode }

const ROOM_CODE = /^[A-Za-z0-9_-]{6,100}$/
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

export function parseRoomCode(value: string): RoomCode | null {
  return ROOM_CODE.test(value) ? (value as RoomCode) : null
}

// Accepts `location.hash` with or without the leading `#`: `#code` and the older `#v1.<code>.<rest>`.
export function parseRoomLink(hash: string): RoomLink {
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash
  if (!fragment) return { kind: 'none' }
  const code = parseRoomCode(fragment.startsWith('v1.') ? fragment.split('.')[1] : fragment)
  return code ? { kind: 'room', code } : { kind: 'invalid' }
}

export function newRoomCode(): RoomCode {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join('') as RoomCode
}
