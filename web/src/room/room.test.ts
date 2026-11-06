import { afterEach, expect, test } from 'vitest'
import { createNetwork, until, visit, type FakeTrack, type Network, type Visitor } from './testing/fake-network'
import type { RoomCode } from './link'

const visitors: Visitor[] = []
afterEach(() => { visitors.splice(0).forEach(visitor => visitor.room.leave()) })

function open(network: Network, name: string, code?: RoomCode) {
  const visitor = visit(network, name, code)
  visitors.push(visitor)
  return visitor
}
async function join(network: Network, name: string, code?: RoomCode) {
  const visitor = open(network, name, code)
  await until(() => visitor.state.status.kind === 'connected', 'automatic room entry')
  return visitor
}
async function mesh(...rooms: Visitor[]) {
  rooms.forEach(room => room.tick(2000))
  await until(() => rooms.every(room => room.state.members.length === rooms.length - 1), 'connected member mesh')
}
async function share(visitor: Visitor) {
  visitor.room.shareScreen('game')
  await until(() => visitor.state.tiles.has('me'), 'local capture')
}
const me = (visitor: Visitor) => visitor.state.me!

test('opening the room link enters and receives an active stream without approval', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  await share(host)
  const guest = await join(network, 'Amigo', host.code)
  await mesh(host, guest)
  await until(() => guest.state.tiles.has(me(host)), 'automatic screen reception')
  expect(guest.state.code).toBe(host.code)
  expect(network.calls.every(call => call.incoming.answered)).toBe(true)
})

test('members exchange screens and cameras in both directions without identity handshakes', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  const guest = await join(network, 'Amigo', host.code)
  await mesh(host, guest)
  host.room.shareScreen('game')
  guest.room.shareScreen('game')
  await host.room.startCamera()
  await guest.room.startCamera()
  await until(() => host.state.tiles.has(me(guest)) && guest.state.tiles.has(me(host)) && host.state.tiles.has(me(guest) + ':camera') && guest.state.tiles.has(me(host) + ':camera'), 'two-way screens and cameras')
  expect(network.calls.length).toBe(4)
  expect(network.calls.every(call => call.incoming.answered)).toBe(true)
})

test('leaving a room closes peer media while other members keep streaming', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  const leaving = await join(network, 'Amigo', host.code)
  await mesh(host, leaving)
  const remaining = await join(network, 'Outro', host.code)
  await mesh(host, leaving, remaining)
  await share(leaving)
  await share(remaining)
  await until(() => remaining.state.tiles.has(me(leaving)) && leaving.state.tiles.has(me(remaining)), 'guest-to-guest streams')
  const leavingId = me(leaving)
  const stale = network.calls.find(call => call.sender === leavingId && call.receiver === me(remaining))!.incoming
  leaving.room.leave()
  await until(() => !remaining.state.members.some(member => member.id === leavingId), 'peer cleanup')
  expect(remaining.state.tiles.has(leavingId)).toBe(false)
  expect(remaining.state.tiles.has('me')).toBe(true)
  expect(network.calls.filter(call => call.sender === leavingId || call.receiver === leavingId).every(call => call.outgoing.closed)).toBe(true)
  stale.emit('stream', stale.stream)
  expect(remaining.state.tiles.has(leavingId)).toBe(false)
})

test('the remaining member reclaims the directory and new link visitors enter after creator departure', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  const guest = await join(network, 'Amigo', host.code)
  await mesh(host, guest)
  host.room.leave()
  guest.runTimeouts(2000)
  await until(() => guest.state.hosting, 'directory takeover')
  await until(() => !!network.peers.get('telao-' + host.code)?.connections.some(connection => connection.open), 'reconnected directory')
  const newcomer = await join(network, 'Outro', host.code)
  await mesh(guest, newcomer)
  expect(guest.state.status).toEqual({ kind: 'connected' })
  expect(newcomer.state.code).toBe(host.code)
})

test('viewer preferences still reduce secondary and hidden video and restore the primary screen', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  await share(host)
  const guest = await join(network, 'Amigo', host.code)
  await mesh(host, guest)
  await until(() => guest.state.tiles.has(me(host)), 'automatic screen reception')
  const outgoing = network.calls.find(call => call.sender === me(host))!.outgoing
  const framerate = () => outgoing.applied.at(-1)?.encodings?.[0].maxFramerate
  guest.room.setViewing({ hidden: false, focus: 'another-screen', thumbnails: new Set() })
  await until(() => framerate() === 15, 'thumbnail video')
  guest.room.setViewing({ hidden: true, focus: 'another-screen', thumbnails: new Set() })
  await until(() => framerate() === 2, 'hidden video')
  guest.room.setViewing({ hidden: false, focus: null, thumbnails: new Set() })
  await until(() => framerate() === 60, 'primary video restored')
  guest.room.setViewing({ hidden: false, focus: null, thumbnails: new Set([me(host)]) })
  await until(() => framerate() === 15, 'a small grid tile gets thumbnail video')
  guest.room.setViewing({ hidden: false, focus: null, thumbnails: new Set(['another-screen']) })
  await until(() => framerate() === 60, 'another small tile leaves this screen primary')
})

test('a network blip on the live directory keeps the room hosted and joinable', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  await share(host)
  const directory = network.peers.get('telao-' + host.code)!
  directory.emit('error', { type: 'network' })
  expect(host.state.hosting).toBe(true)
  expect(directory.destroyed).toBe(false)
  const guest = await join(network, 'Amigo', host.code)
  await mesh(host, guest)
  await until(() => guest.state.tiles.has(me(host)), 'video after the blip')
})

test('losing the directory id releases ownership so the room recovers without refreshing or stopping capture', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  await share(host)
  const directoryId = 'telao-' + host.code
  const previous = network.peers.get(directoryId)
  previous!.emit('error', { type: 'unavailable-id' })
  expect(host.state.hosting).toBe(false)
  host.tick(2000)
  await until(() => host.state.hosting && network.peers.get(directoryId) !== previous, 'directory recovery')
  const guest = await join(network, 'Amigo', host.code)
  await mesh(host, guest)
  await until(() => guest.state.tiles.has(me(host)), 'video after directory recovery')
  const track = host.state.tiles.get('me')!.stream.getVideoTracks()[0] as unknown as FakeTrack
  expect(track.stopped).toBe(false)
})

test('the room capacity limits the mesh to eight people without adding approval', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  const members = [host]
  for (let i = 0; i < 7; i++) members.push(await join(network, 'Amigo ' + i, host.code))
  await mesh(...members)
  const overflow = open(network, 'Outro', host.code)
  const statuses: string[] = []
  overflow.room.subscribe(() => statuses.push(overflow.state.status.kind))
  await until(() => overflow.state.status.kind === 'closed', 'capacity rejection')
  expect(overflow.state.status).toEqual({ kind: 'closed', reason: 'full' })
  expect(statuses).not.toContain('connected')
  expect(members.every(member => member.state.members.length === 7)).toBe(true)
})

test('a newly claimed directory keeps members whose direct connection is still open', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  const first = await join(network, 'Amigo', host.code)
  const second = await join(network, 'Outro', host.code)
  await mesh(host, first, second)
  await share(second)
  await until(() => first.state.tiles.has(me(second)), 'screen before the creator leaves')
  host.room.leave()
  await until(() => first.state.members.length === 1 && second.state.members.length === 1, 'creator gone')
  first.runTimeouts(2000)
  await until(() => first.state.hosting, 'first member takes the directory')
  expect(first.state.members.map(member => member.id)).toEqual([me(second)])
  expect(first.state.tiles.has(me(second))).toBe(true)
  second.runTimeouts(2000)
  const directory = network.peers.get('telao-' + host.code)!
  await until(() => second.hasTimeout(300), 'second claim steps down on unavailable-id')
  expect(second.state.hosting).toBe(false)
  second.runTimeouts(300)
  await until(() => directory.connections.filter(connection => connection.open).length === 2, 'second member rejoins the directory')
  expect(second.state.tiles.size).toBe(1)
  expect(first.state.members.map(member => member.id)).toEqual([me(second)])
})

test('feature messages reach their subscribers and malformed ones are dropped', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  const guest = await join(network, 'Amigo', host.code)
  await mesh(host, guest)
  const received: unknown[] = []
  guest.room.onMessage('react', (message, from) => received.push([message, from]))
  const unsubscribe = guest.room.onMessage('meme', message => received.push(message))
  unsubscribe()
  host.room.broadcast({ t: 'react', e: '🔥', target: host.room.toWire('me') })
  host.room.broadcast({ t: 'meme', k: 'x:bruh' })
  host.room.send(me(guest), { t: 'react', e: 42, target: 'x' } as never)
  host.room.send(me(guest), { t: 'react', e: '😂', target: me(guest) })
  await until(() => received.length === 2, 'two valid reactions')
  expect(received).toEqual([
    [{ t: 'react', e: '🔥', target: me(host) }, me(host)],
    [{ t: 'react', e: '😂', target: me(guest) }, me(host)],
  ])
  expect(guest.room.fromWire(me(guest))).toBe('me')
  expect(guest.state.members).toEqual([{ id: me(host), name: 'Lucas', notif: false, away: false }])
  host.room.setName('  Lucão  ')
  await until(() => guest.state.members[0].name === 'Lucão', 'rename reaches the room')
})

test('the directory lets four people share and denies a fifth', async () => {
  const network = createNetwork(), host = await join(network, 'Lucas')
  const members = [host]
  for (let i = 0; i < 4; i++) members.push(await join(network, 'Amigo ' + i, host.code))
  await mesh(...members)
  for (const member of members.slice(0, 4)) await share(member)
  const notices: string[] = []
  const fifth = members[4]
  fifth.room.onNotice(notice => notices.push(notice))
  fifth.room.shareScreen('game')
  await until(() => notices.length > 0, 'deny notice')
  expect(notices).toEqual(['share-denied'])
  expect(fifth.state.screen).toEqual({ status: 'off' })
  expect(fifth.media.displayRequests).toEqual([])
  members[0].room.stopScreen()
  await until(() => !fifth.state.tiles.has(me(members[0])), 'first sharer stopped')
  await share(fifth)
})
