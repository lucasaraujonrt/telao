import { expect, test } from 'vitest'
import { CameraCallMetadata, HubMessage, HubRequest, isFeatureMessage, MemberMessage, parse, validPeerIds } from './protocol'

test('hello trims the name and reads notif and away only when they are true', () => {
  expect(parse(MemberMessage, { t: 'hello', name: 'x'.repeat(40), notif: true, away: 'yes' }))
    .toEqual({ t: 'hello', name: 'x'.repeat(24), notif: true, away: false })
})

test.each([
  null, 'hello', 42, [], {}, { t: 'nope' },
  { t: 'hello' },
  { t: 'stream-preference', preference: 'huge' },
  { t: 'camera-stop', session: 1.5 },
  { t: 'camera-stop', session: Number.MAX_SAFE_INTEGER + 2 },
  { t: 'throw', item: 'ovo', target: 'a', x: '1', y: 2 },
  { t: 'dshot', d: 'abc', e: [1, 2] },
  { t: 'peers', ids: [] },
])('member channel drops %j', data => {
  expect(parse(MemberMessage, data)).toBe(null)
})

test('feature messages parse and are told apart from core ones', () => {
  const meme = parse(MemberMessage, { t: 'meme', k: 'x:bruh', label: 'Bruh', extra: 1 })
  expect(meme).toEqual({ t: 'meme', k: 'x:bruh', label: 'Bruh' })
  expect(isFeatureMessage(meme!)).toBe(true)
  expect(isFeatureMessage(parse(MemberMessage, { t: 'member-ready' })!)).toBe(false)
  expect(parse(MemberMessage, { t: 'dpos', d: 'abc', x: 1, y: 2, z: 3, yaw: 0, dead: false })).not.toBe(null)
})

test('peers lists allow at most eight entries and keep only valid ids', () => {
  const ids = ['a', 'b-c_1', '', 'bad id', 7, 'x'.repeat(101), 'ok']
  expect(parse(HubMessage, { t: 'peers', ids })).toEqual({ t: 'peers', ids })
  expect(validPeerIds(ids)).toEqual(['a', 'b-c_1', 'ok'])
  expect(parse(HubMessage, { t: 'peers', ids: Array(9).fill('a') })).toBe(null)
  expect(parse(HubMessage, { t: 'peers', ids: 'a' })).toBe(null)
  expect(parse(HubMessage, { t: 'grant' })).toEqual({ t: 'grant' })
  expect(parse(HubMessage, { t: 'want' })).toBe(null)
})

test('the hub only accepts sharing, stop and want', () => {
  expect(parse(HubRequest, { t: 'want' })).toEqual({ t: 'want' })
  expect(parse(HubRequest, { t: 'peers', ids: [] })).toBe(null)
})

test('camera call metadata needs a safe integer session', () => {
  expect(parse(CameraCallMetadata, { kind: 'camera', session: 3 })).toEqual({ kind: 'camera', session: 3 })
  expect(parse(CameraCallMetadata, { kind: 'camera', session: '3' })).toBe(null)
  expect(parse(CameraCallMetadata, undefined)).toBe(null)
})

test('a meme keeps its key and cleans its label, or drops a label that is not text', () => {
  expect(parse(MemberMessage, { t: 'meme', k: 'faaah', label: '  Um   meme\n com nome muito comprido demais  ' }))
    .toEqual({ t: 'meme', k: 'faaah', label: 'Um meme com nome muito comprid' })
  expect(parse(MemberMessage, { t: 'meme', k: 'faaah', label: 42 })).toEqual({ t: 'meme', k: 'faaah' })
  expect(parse(MemberMessage, { t: 'meme', k: 'faaah', label: '   ' })).toEqual({ t: 'meme', k: 'faaah' })
  expect(parse(MemberMessage, { t: 'meme', k: 'faaah' })).toEqual({ t: 'meme', k: 'faaah' })
})

test.each([
  { t: 'meme' },
  { t: 'meme', k: 7 },
  { t: 'meme', k: 'x:' + 'a'.repeat(99) },
  { t: 'react', e: '👍', target: 'a' },
  { t: 'react', e: '🔥' },
  { t: 'react', e: '🔥', target: 'a'.repeat(121) },
  { t: 'throw', item: 'pedra', target: 'a', x: 0.5, y: 0.5 },
  { t: 'throw', item: 'ovo', target: 'a', x: Number.NaN, y: 0.5 },
  { t: 'throw', item: 'ovo', target: 'a', x: Infinity, y: 0.5 },
  { t: 'throw', item: 'ovo', x: 0.5, y: 0.5 },
])('zoeira message drops %j', data => {
  expect(parse(MemberMessage, data)).toBe(null)
})

test('reactions and throws keep their target, and a throw lands inside the tile', () => {
  expect(parse(MemberMessage, { t: 'react', e: '💀', target: 'abc:camera' })).toEqual({ t: 'react', e: '💀', target: 'abc:camera' })
  expect(parse(MemberMessage, { t: 'throw', item: 'chinelo', target: 'abc', x: -3, y: 7 }))
    .toEqual({ t: 'throw', item: 'chinelo', target: 'abc', x: 0, y: 1 })
  expect(parse(MemberMessage, { t: 'throw', item: 'tomate', target: 'abc', x: 0.25, y: 0.75 }))
    .toEqual({ t: 'throw', item: 'tomate', target: 'abc', x: 0.25, y: 0.75 })
})
