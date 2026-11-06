import { expect, test } from 'vitest'
import { fetchIceConfig } from './ice'

const stun = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
const respond = (ok: boolean, body: unknown) => (async () => ({ ok, json: async () => body })) as unknown as typeof fetch

test('uses the TURN list from /api/ice', async () => {
  const iceServers = [{ urls: 'turn:turn.example:3478', username: 'u', credential: 'c' }]
  let requested: unknown
  const fetcher = (async (url: unknown) => { requested = url; return { ok: true, json: async () => ({ iceServers }) } }) as unknown as typeof fetch
  expect(await fetchIceConfig(fetcher)).toEqual({ iceServers })
  expect(requested).toBe('/api/ice')
})

test.each([
  ['an error status', respond(false, {})],
  ['an empty list', respond(true, { iceServers: [] })],
  ['a malformed body', respond(true, { iceServers: 'turn:x' })],
  ['a network failure', (async () => { throw new TypeError('offline') }) as unknown as typeof fetch],
])('falls back to STUN on %s', async (_label, fetcher) => {
  expect(await fetchIceConfig(fetcher)).toEqual(stun)
})
