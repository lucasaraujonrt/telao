import { afterEach, expect, test } from 'vitest'
import { createNetwork, until, visit, type Visitor } from '../room/testing/fake-network'
import { createMemes, AWAY } from './memes/memes'
import { createReactions } from './reactions/reactions'
import { createThrowables } from './throwables/throwables'

const visitors: Visitor[] = []
afterEach(() => { visitors.splice(0).forEach(visitor => visitor.room.leave()) })

async function pair() {
  const network = createNetwork()
  const host = visit(network, 'Lucas'); visitors.push(host)
  await until(() => host.state.status.kind === 'connected', 'host entry')
  const guest = visit(network, 'Amigo', host.code); visitors.push(guest)
  await until(() => guest.state.status.kind === 'connected', 'guest entry')
  host.tick(2000); guest.tick(2000)
  await until(() => host.state.members.length === 1 && guest.state.members.length === 1, 'mesh')
  return { host, guest }
}
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

function memesFor(visitor: Visitor, clock: { t: number }, away = { on: false }) {
  const played: string[] = [], notes: string[] = []
  const memes = createMemes({
    room: visitor.room,
    sounds: { play: url => played.push(url) },
    isAway: () => away.on,
    labelOf: key => key === 'faaah' ? 'FAAAH' : undefined,
    nameOf: id => visitor.state.members.find(member => member.id === id)?.name ?? '?',
    notify: text => notes.push(text),
    now: () => clock.t,
    timers: { setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {} },
  })
  return { memes, played, notes, away }
}

test('a meme plays for the whole room and names who sent it', async () => {
  const { host, guest } = await pair(), clock = { t: 0 }
  const sender = memesFor(host, clock), receiver = memesFor(guest, clock)
  sender.memes.fire('faaah')
  expect(sender.played).toEqual(['/sounds/faaah.mp3'])
  expect(sender.notes).toEqual(['Você: FAAAH'])
  expect(sender.memes.cooling()).toBe(true)
  sender.memes.fire('faaah')
  await until(() => receiver.played.length === 1, 'meme arrives')
  expect(receiver.notes).toEqual(['Lucas: FAAAH'])
  expect(sender.played).toHaveLength(1)
})

test('incoming memes are rate limited per sender, bad keys are dropped and the label is the sender\'s', async () => {
  const { host, guest } = await pair(), clock = { t: 0 }
  const receiver = memesFor(guest, clock)
  host.room.broadcast({ t: 'meme', k: 'x:bruh', label: 'Bruh' })
  host.room.broadcast({ t: 'meme', k: 'x:outro' })
  host.room.broadcast({ t: 'meme', k: 'https://evil.example/a.mp3' })
  await flush(); await flush()
  expect(receiver.played).toEqual(['https://www.myinstants.com/media/sounds/bruh.mp3'])
  expect(receiver.notes).toEqual(['Lucas: Bruh'])
  clock.t = 1000
  host.room.broadcast({ t: 'meme', k: 'https://evil.example/a.mp3' })
  host.room.broadcast({ t: 'meme', k: 'x:outro' })
  await until(() => receiver.played.length === 2, 'next meme after a second')
  expect(receiver.notes[1]).toBe('Lucas: meme')
})

test('away drops memes, throws and reactions for that viewer only', async () => {
  const { host, guest } = await pair(), clock = { t: 0 }
  const sender = memesFor(host, clock), away = memesFor(guest, clock, { on: true })
  const landed: unknown[] = [], shown: unknown[] = [], notes: string[] = []
  const base = { room: guest.room, isAway: () => true, now: () => clock.t }
  createThrowables({ ...base, nameOf: () => 'Lucas', notify: text => notes.push(text), onLand: (...args) => landed.push(args) })
  createReactions({ ...base, onShow: (...args) => shown.push(args) })
  away.memes.fire('faaah')
  expect(away.notes).toEqual([AWAY])
  expect(away.played).toEqual([])
  sender.memes.fire('faaah')
  host.room.broadcast({ t: 'throw', item: 'ovo', target: host.room.toWire('me'), x: 0.5, y: 0.5 })
  host.room.broadcast({ t: 'react', e: '🔥', target: host.room.toWire('me') })
  await flush(); await flush()
  expect([away.played, landed, shown, notes]).toEqual([[], [], [], []])
  expect(sender.played).toEqual(['/sounds/faaah.mp3'])
})

test('a throw lands on the tile it was aimed at, and the target is told who hit them', async () => {
  const { host, guest } = await pair(), clock = { t: 0 }
  const landed: unknown[][] = [], notes: string[] = [], mine: unknown[][] = []
  const thrower = createThrowables({ room: host.room, isAway: () => false, nameOf: () => '?', notify() {}, onLand: (...args) => mine.push(args), now: () => clock.t })
  createThrowables({ room: guest.room, isAway: () => false, nameOf: () => 'Lucas', notify: text => notes.push(text), onLand: (...args) => landed.push(args), now: () => clock.t })
  const target = host.state.members[0].id
  thrower.throwAt(target, 'chinelo', 1.4, 0.25)
  thrower.throwAt(target, 'ovo', 0.5, 0.5)
  await until(() => landed.length === 1, 'throw lands')
  expect(mine).toEqual([[target, 'chinelo', 1, 0.25]])
  expect(landed).toEqual([['me', 'chinelo', 1, 0.25]])
  expect(notes).toEqual(['Lucas te acertou uma chinelada'])
  clock.t = 300
  thrower.throwAt('me', 'tomate', 0.1, 0.9)
  await until(() => landed.length === 2, 'second throw lands')
  expect(landed[1]).toEqual([host.state.me, 'tomate', 0.1, 0.9])
  expect(notes).toHaveLength(1)
})

test('reactions float on the target tile and are rate limited per sender', async () => {
  const { host, guest } = await pair(), clock = { t: 0 }
  const shown: unknown[][] = []
  const reactions = createReactions({ room: host.room, isAway: () => false, onShow() {}, now: () => clock.t })
  createReactions({ room: guest.room, isAway: () => false, onShow: (...args) => shown.push(args), now: () => clock.t })
  reactions.react('me', '😂')
  host.room.broadcast({ t: 'react', e: '💀', target: host.room.toWire('me') })
  host.room.broadcast({ t: 'react', e: '👍' as never, target: host.room.toWire('me') })
  await flush(); await flush()
  expect(shown).toEqual([[host.state.me, '😂']])
  clock.t = 120
  reactions.react('me:camera', '🔥')
  await until(() => shown.length === 2, 'second reaction')
  expect(shown[1]).toEqual([host.state.me + ':camera', '🔥'])
})
