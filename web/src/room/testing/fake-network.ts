import type { DataChannel, MediaCall, PeerError, SignalPeer } from '../peer'
import type { SenderParameters } from '../../media/streaming'
import { createRoom, type Room, type RoomMedia } from '../room'
import { newRoomCode, type RoomCode } from '../link'
import type { Timers } from '../../media/timers'

// An in-memory PeerJS: peers find each other by id and deliver data on microtasks, like the
// prototype's tests/helpers/room-runtime.cjs.

type Listener = (...args: any[]) => void

class Emitter {
  private listeners = new Map<string, Listener[]>()
  on(event: string, listener: Listener) {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener])
  }
  emit(event: string, ...args: unknown[]) {
    for (const listener of this.listeners.get(event) ?? []) listener(...args)
  }
}

export interface FakeTrack {
  kind: 'video' | 'audio'
  stopped: boolean
  contentHint: string
  onended: (() => void) | null
  stop(): void
  getSettings(): { displaySurface?: string }
}

export function fakeStream(displaySurface = 'window'): MediaStream {
  const track: FakeTrack = { kind: 'video', stopped: false, contentHint: '', onended: null, stop() { this.stopped = true }, getSettings: () => ({ displaySurface }) }
  return { getTracks: () => [track], getVideoTracks: () => [track], getAudioTracks: () => [], removeTrack() {} } as unknown as MediaStream
}

export class FakeConnection extends Emitter implements DataChannel {
  open = false
  closed = false
  other?: FakeConnection
  readonly peer: string
  constructor(peer: string) { super(); this.peer = peer }
  send(message: unknown) {
    if (!this.open) return
    queueMicrotask(() => { if (this.other?.open) this.other.emit('data', structuredClone(message)) })
  }
  close() {
    if (this.closed) return
    this.closed = true; this.open = false; this.emit('close'); this.other?.close()
  }
}

export class FakeCall extends Emitter implements MediaCall {
  closed = false
  answered = false
  other?: FakeCall
  applied: SenderParameters[] = []
  readonly peer: string
  readonly stream: MediaStream
  readonly metadata: unknown
  readonly peerConnection
  constructor(peer: string, stream: MediaStream, metadata: unknown) {
    super(); this.peer = peer; this.stream = stream; this.metadata = metadata
    const sender = {
      track: stream.getVideoTracks()[0] as MediaStreamTrack | null,
      getParameters: (): SenderParameters => ({ encodings: [{}] }),
      setParameters: async (parameters: SenderParameters) => { this.applied.push(structuredClone(parameters)) },
      replaceTrack: async (next: MediaStreamTrack) => { sender.track = next },
    }
    this.peerConnection = { getSenders: () => [sender], getStats: async () => new Map(), addEventListener() {}, removeEventListener() {} }
  }
  answer() { this.answered = true; queueMicrotask(() => { if (!this.closed) this.emit('stream', this.stream) }) }
  close() { if (this.closed) return; this.closed = true; this.emit('close'); this.other?.close() }
}

export interface CallRecord { sender: string; receiver: string; outgoing: FakeCall; incoming: FakeCall }

export function createNetwork() {
  const peers = new Map<string, FakePeer>(), calls: CallRecord[] = []
  let sequence = 0

  class FakePeer extends Emitter implements SignalPeer {
    readonly id: string
    destroyed = false
    open = false
    disconnected = false
    connections: FakeConnection[] = []
    constructor(id: string | undefined) {
      super()
      this.id = id ?? `peer-${++sequence}`
      if (peers.has(this.id)) { queueMicrotask(() => this.emit('error', { type: 'unavailable-id' } satisfies PeerError)); return }
      peers.set(this.id, this)
      queueMicrotask(() => { if (!this.destroyed) { this.open = true; this.emit('open', this.id) } })
    }
    connect(id: string) {
      const outgoing = new FakeConnection(id), incoming = new FakeConnection(this.id)
      outgoing.other = incoming; incoming.other = outgoing; this.connections.push(outgoing)
      queueMicrotask(() => {
        const target = peers.get(id)
        if (!target) { this.emit('error', { type: 'peer-unavailable', message: id }); outgoing.close(); return }
        target.connections.push(incoming); target.emit('connection', incoming)
        if (incoming.closed || outgoing.closed) return
        incoming.open = outgoing.open = true; incoming.emit('open'); outgoing.emit('open')
      })
      return outgoing
    }
    call(id: string, stream: MediaStream, options: { metadata?: unknown } = {}) {
      const outgoing = new FakeCall(id, stream, options.metadata)
      const incoming = new FakeCall(this.id, stream, options.metadata)
      outgoing.other = incoming; incoming.other = outgoing
      calls.push({ sender: this.id, receiver: id, outgoing, incoming })
      queueMicrotask(() => peers.get(id)?.emit('call', incoming))
      return outgoing
    }
    destroy() {
      if (this.destroyed) return
      this.destroyed = true
      if (peers.get(this.id) === this) peers.delete(this.id)
      this.connections.forEach(connection => connection.close())
      this.emit('close')
    }
    reconnect() {}
  }

  return { peers, calls, createPeer: (id: string | undefined) => new FakePeer(id) }
}
export type Network = ReturnType<typeof createNetwork>

export async function until(predicate: () => boolean, label = 'condition') {
  for (let i = 0; i < 500; i++) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  throw Error(`Did not reach ${label}`)
}

interface FakeTimer { callback: () => void; ms: number }

export function fakeTimers() {
  const intervals = new Set<FakeTimer>(), timeouts = new Set<FakeTimer>()
  const timers: Timers = {
    setTimeout: (callback, ms) => { const timer = { callback, ms }; timeouts.add(timer); return timer },
    clearTimeout: handle => { timeouts.delete(handle as FakeTimer) },
    setInterval: (callback, ms) => { const timer = { callback, ms }; intervals.add(timer); return timer },
    clearInterval: handle => { intervals.delete(handle as FakeTimer) },
  }
  return {
    timers, intervals, timeouts,
    hasTimeout: (ms: number) => [...timeouts].some(timer => timer.ms === ms),
    tick(ms: number) { for (const timer of [...intervals]) if (timer.ms === ms) timer.callback() },
    runTimeouts(maxMs = Infinity) { for (const timer of [...timeouts]) if (timer.ms <= maxMs) { timeouts.delete(timer); timer.callback() } },
  }
}

export interface Visitor {
  room: Room
  code: RoomCode
  readonly state: ReturnType<Room['getSnapshot']>
  media: RoomMedia & { displayRequests: unknown[] }
  tick(ms: number): void
  hasTimeout(ms: number): boolean
  runTimeouts(maxMs?: number): void
}

export function visit(network: Network, name: string, code: RoomCode = newRoomCode()): Visitor {
  const clock = fakeTimers()
  const displayRequests: unknown[] = []
  const media = {
    displayRequests,
    getDisplayMedia: async (options: unknown) => { displayRequests.push(options); return fakeStream() },
    getUserMedia: async () => fakeStream(),
    createVideo: () => ({ muted: false, playsInline: false, srcObject: null as unknown, play: async () => {}, pause() {} }),
  }
  const room = createRoom({ code, name, iceConfig: { iceServers: [] }, createPeer: network.createPeer, media, timers: clock.timers, random: () => 0.5 })
  return { room, code, media, get state() { return room.getSnapshot() }, tick: clock.tick, hasTimeout: clock.hasTimeout, runTimeouts: clock.runTimeouts }
}

