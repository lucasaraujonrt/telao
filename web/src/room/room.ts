import { createCameraSource, type CameraCanvas, type CameraEffect, type CameraSource } from '../media/camera-source'
import { captureScreen, SCREEN_PROFILES, type CaptureDevices, type DisplaySurface, type ScreenProfileName } from '../media/capture'
import { createStreamController, preferH264, readVideoStats, type StreamPreference, type VideoStats } from '../media/streaming'
import { browserTimers, type TimerHandle, type Timers } from '../media/timers'
import type { RoomCode } from './link'
import type { CreatePeer, DataChannel, MediaCall, SignalPeer } from './peer'
import {
  CameraCallMetadata, HubMessage, HubRequest, isFeatureMessage, MAX_MEMBERS, MAX_SHARERS, MemberMessage, NAME_LENGTH, parse, validPeerIds,
  type FeatureMessage, type FeatureMessageOf, type FeatureType, type PeerId,
} from './protocol'

export const DIRECTORY_PREFIX = 'telao-'
const ICE_GRACE_MS = 15_000
const MEDIA_RETRY_MS = 3000

export interface CameraVideo {
  muted: boolean
  playsInline: boolean
  srcObject: unknown
  play(): Promise<void>
  pause(): void
}

export interface RoomMedia extends CaptureDevices {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>
  createVideo?: () => CameraVideo
  createCanvas?: () => CameraCanvas
}

export interface RoomOptions {
  code: RoomCode
  name: string
  away?: boolean
  canNotify?: () => boolean
  iceConfig: RTCConfiguration
  createPeer: CreatePeer
  media: RoomMedia
  timers?: Timers
  random?: () => number
}

export type RoomStatus =
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'closed'; reason: 'closed' | 'full' }

export interface Member {
  id: PeerId
  /** null until the member's hello arrives; the prototype shows "conectando…". */
  name: string | null
  notif: boolean
  away: boolean
}

/** Keys: 'me', 'me:camera', a peer id, or `${peerId}:camera`. */
export type TileKey = string

export interface Tile {
  key: TileKey
  owner: 'me' | PeerId
  kind: 'screen' | 'camera'
  stream: MediaStream
}

export type ScreenState =
  | { status: 'off' }
  | { status: 'starting'; profile: ScreenProfileName }
  | { status: 'live'; profile: ScreenProfileName; surface: DisplaySurface; hasAudio: boolean }

export interface CameraState {
  status: 'off' | 'starting' | 'on'
  effect: CameraEffect
}

export interface RoomSnapshot {
  code: RoomCode
  status: RoomStatus
  me: PeerId | null
  name: string
  away: boolean
  hosting: boolean
  members: readonly Member[]
  tiles: ReadonlyMap<TileKey, Tile>
  screen: ScreenState
  camera: CameraState
}

export type RoomNotice =
  | 'share-denied'
  | 'camera-not-allowed'
  | 'camera-not-found'
  | 'camera-failed'
  | 'camera-effect-failed'

export interface Viewing {
  /** True when the page is hidden and no picture-in-picture window shows it. */
  hidden: boolean
  /** The fullscreen tile, or the theater focus, or null. */
  focus: TileKey | null
  /** Tiles drawn too small to need full quality, such as a narrow panel in the grid. */
  thumbnails: ReadonlySet<TileKey>
}

export interface Room {
  getSnapshot(): RoomSnapshot
  subscribe(listener: () => void): () => void
  onNotice(listener: (notice: RoomNotice) => void): () => void
  onMessage<T extends FeatureType>(type: T, handler: (message: FeatureMessageOf<T>, from: PeerId) => void): () => void
  shareScreen(profile: ScreenProfileName): void
  stopScreen(): void
  startCamera(): Promise<void>
  stopCamera(): void
  setCameraEffect(effect: CameraEffect): Promise<void>
  setViewing(viewing: Viewing): void
  setName(name: string): void
  setAway(away: boolean): void
  announce(): void
  send(id: PeerId, message: FeatureMessage): void
  broadcast(message: FeatureMessage): void
  toWire(key: TileKey): string
  fromWire(id: string): TileKey
  sampleStats(): Promise<Map<TileKey, VideoStats[]>>
  leave(): void
}

interface MemberChannel {
  channel: DataChannel
  ready: boolean
  shared: boolean
}

type Profile = { name: string | null; notif: boolean; away: boolean }

// PeerJS rarely fires "close" when the other tab just vanishes; the ICE state does change.
function watch(timers: Timers, connection: DataChannel) {
  const pc = connection.peerConnection; if (!pc) return
  let timer: TimerHandle | undefined
  pc.addEventListener('connectionstatechange', () => {
    if (timer !== undefined) timers.clearTimeout(timer)
    const state = pc.connectionState
    if (state === 'failed' || state === 'closed') connection.close()
    else if (state === 'disconnected') timer = timers.setTimeout(() => connection.close(), ICE_GRACE_MS)
  })
}

export function createRoom(options: RoomOptions): Room {
  const { code, iceConfig: config, createPeer, media, timers = browserTimers, random = Math.random, canNotify = () => false } = options
  const hubId = DIRECTORY_PREFIX + code
  let myName = options.name.trim().slice(0, NAME_LENGTH) || 'Anônimo'
  let away = options.away ?? false

  const peer = createPeer(undefined, { config })
  const conns = new Map<PeerId, MemberChannel>()
  const cameraCalls = new Map<PeerId, MediaCall>(), incomingScreens = new Map<PeerId, MediaCall>()
  const incomingCameras = new Map<PeerId, { call: MediaCall; session: number }>(), stoppedCameras = new Map<PeerId, number>()
  const connecting = new Map<PeerId, DataChannel>(), roomMembers = new Set<PeerId>()
  const profiles = new Map<PeerId, Profile>()
  const sharers = new Set<PeerId>()
  const tiles = new Map<TileKey, Tile>()
  const calls = new Map<PeerId, MediaCall>()
  const receiverPreferences = new Map<PeerId, StreamPreference>(), sentPreferences = new WeakMap<DataChannel, StreamPreference>()
  const diagSamples = new WeakMap<MediaCall, VideoStats>()
  const listeners = new Set<() => void>(), noticeListeners = new Set<(notice: RoomNotice) => void>()
  const handlers = new Map<FeatureType, Set<(message: FeatureMessage, from: PeerId) => void>>()
  const intervals = new Set<TimerHandle>()
  const streaming = createStreamController({ uploadBudget: 8_000_000, timers })
  let roomEntered = false, ended: RoomStatus | null = null
  let cameraSession = 0, cameraCancelled = 0
  let cameraStream: MediaStream | null = null, cameraRaw: MediaStream | null = null, cameraSource: CameraSource<MediaStream> | null = null
  let cameraVideo: CameraVideo | null = null, cameraPending = false, cameraEffect: CameraEffect = 'normal'
  let stream: MediaStream | null = null, capturing = false, screen: ScreenState = { status: 'off' }, requestedProfile: ScreenProfileName = 'game'
  let myId: PeerId | null = null, hub: { peer: SignalPeer; conns: Map<PeerId, DataChannel> } | null = null
  let hubConn: DataChannel | null = null, claiming = false, directoryPeer: SignalPeer | null = null
  let viewing: Viewing = { hidden: false, focus: null, thumbnails: new Set() }
  let snapshot = buildSnapshot()

  const every = (callback: () => void, ms: number) => { intervals.add(timers.setInterval(callback, ms)) }
  const notice = (value: RoomNotice) => noticeListeners.forEach(listener => listener(value))
  const hello = () => ({ t: 'hello', name: myName, notif: canNotify(), away })
  const isEnded = () => ended !== null

  function buildSnapshot(): RoomSnapshot {
    return {
      code,
      status: ended ?? (roomEntered ? { kind: 'connected' } : { kind: 'connecting' }),
      me: myId, name: myName, away, hosting: !!hub,
      members: [...conns.keys()].map(id => ({ id, name: null, notif: false, away: false, ...profiles.get(id) })),
      tiles: new Map(tiles),
      screen,
      camera: { status: cameraStream ? 'on' : cameraPending ? 'starting' : 'off', effect: cameraEffect },
    }
  }
  // Every place the prototype called render(): rebuild the snapshot and resend viewer preferences.
  function changed() {
    snapshot = buildSnapshot()
    sendPreferences()
    listeners.forEach(listener => listener())
  }
  function addTile(key: TileKey, media: MediaStream) {
    const camera = key.endsWith(':camera'), owner = key.replace(/:camera$/, '')
    tiles.set(key, { key, owner, kind: camera ? 'camera' : 'screen', stream: media })
    changed()
  }
  function dropTile(key: TileKey) {
    if (tiles.delete(key)) changed()
  }

  // Reconnect to the signalling server after a short pause; an immediate retry can hit "ID taken"
  // while the server still holds the old socket, and loop.
  function retryServer(target: SignalPeer) {
    timers.setTimeout(() => { if (target.disconnected && !target.destroyed) try { target.reconnect() } catch { /* next disconnect retries */ } }, 1500 + random() * 1500)
  }

  peer.on('open', id => { myId = id; joinHub() })
  peer.on('disconnected', () => retryServer(peer))
  peer.on('error', error => {
    if (error.type === 'peer-unavailable') { if (String(error.message).includes(hubId)) claimHub(); return }
    if (error.type !== 'disconnected' && error.type !== 'network') console.warn('peer', error.type)
  })
  peer.on('close', () => finishRoom('closed'))
  peer.on('connection', connection => wire(connection))
  peer.on('call', call => {
    if (!connectedMember(call.peer)) { call.close(); return }
    const camera = (call.metadata as { kind?: unknown } | undefined)?.kind === 'camera'
    const key = camera ? call.peer + ':camera' : call.peer
    let current: () => boolean
    if (camera) {
      const metadata = parse(CameraCallMetadata, call.metadata)
      const previous = incomingCameras.get(call.peer)
      if (!metadata || metadata.session <= (stoppedCameras.get(call.peer) || 0) || metadata.session < (previous?.session || 0)) { call.close(); return }
      incomingCameras.set(call.peer, { call, session: metadata.session }); previous?.call.close()
      current = () => incomingCameras.get(call.peer)?.call === call
    } else {
      const previous = incomingScreens.get(call.peer); incomingScreens.set(call.peer, call); previous?.close()
      current = () => incomingScreens.get(call.peer) === call
    }
    call.answer()
    call.on('stream', media => { if (connectedMember(call.peer) && current()) addTile(key, media); else call.close() })
    call.on('close', () => {
      if (!current()) return
      if (camera) incomingCameras.delete(call.peer); else incomingScreens.delete(call.peer)
      dropTile(key)
    })
    call.on('error', () => call.close())
  })

  function connectedMember(id: PeerId) { return !isEnded() && roomMembers.has(id) && !!conns.get(id)?.channel.open }
  function enterConnectedRoom() {
    if (roomEntered || isEnded()) return
    roomEntered = true; changed()
  }
  function disconnectMember(id: PeerId) {
    connecting.get(id)?.close(); connecting.delete(id)
    const member = conns.get(id); conns.delete(id); member?.channel.close()
    for (const registry of [calls, cameraCalls, incomingScreens]) {
      const call = registry.get(id); registry.delete(id); call?.close()
    }
    const camera = incomingCameras.get(id); incomingCameras.delete(id); camera?.call.close()
    profiles.delete(id); stoppedCameras.delete(id)
    void streaming.remove(id); receiverPreferences.delete(id)
    tiles.delete(id); tiles.delete(id + ':camera'); changed()
    void streaming.refresh()
  }
  function finishRoom(reason: 'closed' | 'full') {
    if (isEnded()) return
    ended = { kind: 'closed', reason }
    intervals.forEach(timer => timers.clearInterval(timer)); intervals.clear()
    stopScreen(); stopCamera(); streaming.stop()
    ;[...conns.keys()].forEach(disconnectMember)
    hub?.conns.forEach(connection => connection.close()); hub?.peer.destroy(); hubConn?.close(); peer.destroy()
    changed()
  }
  function connectMembers() {
    if (isEnded()) return
    roomMembers.forEach(id => {
      if (myId !== null && id !== myId && myId < id && !conns.has(id) && !connecting.has(id)) link(id)
    })
  }
  function publishDirectory() {
    if (!hub || isEnded()) return
    const ids = [...hub.conns.keys()]
    hub.conns.forEach(connection => { if (connection.open) connection.send({ t: 'peers', ids }) })
  }
  function claimHub() {
    if (isEnded() || hub || claiming) return
    claiming = true
    const directory = createPeer(hubId, { config })
    directoryPeer = directory
    const releaseDirectory = () => {
      if (directoryPeer !== directory) return
      directoryPeer = null; claiming = false
      if (hub?.peer === directory) { hub = null; sharers.clear(); changed() }
    }
    directory.on('open', () => {
      if (isEnded() || directoryPeer !== directory) { directory.destroy(); return }
      claiming = false; hub = { peer: directory, conns: new Map() }; changed(); joinHub()
    })
    directory.on('close', releaseDirectory)
    directory.on('disconnected', () => retryServer(directory))
    directory.on('error', error => {
      // A signalling blip on the live hub is not fatal: its data channels stay up and it reconnects.
      // Step down only if the claim never opened or someone else now owns the room id.
      if (hub?.peer === directory && error.type !== 'unavailable-id') return
      releaseDirectory(); directory.destroy()
      if (error.type === 'unavailable-id' && !isEnded()) timers.setTimeout(joinHub, 300)
    })
    directory.on('connection', connection => {
      connection.on('open', () => {
        // A directory that already stepped down has no room to offer; the member reconnects elsewhere.
        if (!hub) { connection.close(); return }
        if (isEnded() || hub.conns.size >= MAX_MEMBERS) {
          connection.send({ t: 'full' }); timers.setTimeout(() => connection.close(), 100); return
        }
        watch(timers, connection); hub.conns.set(connection.peer, connection); publishDirectory()
      })
      connection.on('data', data => {
        if (hub?.conns.get(connection.peer) !== connection) return
        const message = parse(HubRequest, data); if (!message) return
        if (message.t === 'sharing') sharers.add(connection.peer)
        else if (message.t === 'stop') sharers.delete(connection.peer)
        else {
          const allowed = sharers.has(connection.peer) || sharers.size < MAX_SHARERS
          if (allowed) sharers.add(connection.peer)
          connection.send({ t: allowed ? 'grant' : 'deny' })
        }
      })
      connection.on('close', () => {
        if (hub?.conns.get(connection.peer) !== connection) return
        hub.conns.delete(connection.peer); sharers.delete(connection.peer); publishDirectory()
      })
    })
  }
  function joinHub() {
    if (isEnded() || claiming || !peer.open) return
    const old = hubConn; hubConn = null; old?.close()
    const connection = peer.connect(hubId, { reliable: true }); hubConn = connection
    connection.on('open', () => { watch(timers, connection); if (stream) connection.send({ t: 'sharing' }) })
    connection.on('data', data => {
      if (isEnded() || hubConn !== connection) return
      const message = parse(HubMessage, data); if (!message) return
      if (message.t === 'peers') {
        if (myId === null || !message.ids.includes(myId)) return
        // A newly claimed hub lists people as they come back, so never drop a member whose
        // direct connection is still open; watch() closes the ones that are really gone.
        roomMembers.clear()
        validPeerIds(message.ids).forEach(id => roomMembers.add(id))
        conns.forEach((member, id) => { if (member.channel.open) roomMembers.add(id) })
        for (const id of [...conns.keys(), ...connecting.keys()]) if (!roomMembers.has(id)) disconnectMember(id)
        enterConnectedRoom(); connectMembers(); changed()
      } else if (message.t === 'grant') void begin()
      else if (message.t === 'deny') notice('share-denied')
      else finishRoom('full')
    })
    connection.on('close', () => {
      if (isEnded() || hubConn !== connection) return
      hubConn = null; timers.setTimeout(claimHub, 200 + random() * 1500)
    })
    connection.on('error', () => connection.close())
  }
  every(() => { if (myId && !claiming && !hubConn?.open) joinHub(); connectMembers() }, 2000)

  function link(id: PeerId) {
    if (isEnded() || !peer.open || !roomMembers.has(id) || connecting.has(id) || conns.has(id)) return
    const connection = peer.connect(id, { reliable: true })
    connecting.set(id, connection); wire(connection)
  }
  function wire(c: DataChannel) {
    if (isEnded() || !roomMembers.has(c.peer) || conns.has(c.peer) || (connecting.has(c.peer) && connecting.get(c.peer) !== c)) { c.close(); return }
    connecting.set(c.peer, c)
    const member: MemberChannel = { channel: c, ready: false, shared: false }
    const shareWithReadyMember = () => {
      if (!connectedMember(c.peer) || !member.ready || member.shared) return
      member.shared = true; timers.clearTimeout(timeout); c.send(hello())
      if (stream) callPeer(c.peer)
      if (cameraStream) callCamera(c.peer)
      changed()
    }
    const timeout = timers.setTimeout(() => { if (!member.ready) c.close() }, 10_000)
    c.on('open', () => {
      if (isEnded() || !roomMembers.has(c.peer)) { c.close(); return }
      watch(timers, c); connecting.delete(c.peer); conns.set(c.peer, member)
      c.send({ t: 'member-ready' }); shareWithReadyMember()
    })
    c.on('data', data => {
      if (!connectedMember(c.peer) || conns.get(c.peer) !== member) return
      const m = parse(MemberMessage, data); if (!m) return
      if (isFeatureMessage(m)) { handlers.get(m.t)?.forEach(handler => handler(m, c.peer)); return }
      switch (m.t) {
        case 'member-ready': member.ready = true; shareWithReadyMember(); break
        case 'hello': profiles.set(c.peer, { name: m.name, notif: m.notif, away: m.away }); changed(); break
        case 'stream-preference': receiverPreferences.set(c.peer, m.preference); void streaming.setPreference(c.peer, m.preference); break
        case 'stop': dropTile(c.peer); break
        case 'camera-stop': {
          stoppedCameras.set(c.peer, Math.max(stoppedCameras.get(c.peer) || 0, m.session))
          const current = incomingCameras.get(c.peer)
          if (current && current.session <= m.session) { current.call.close(); incomingCameras.delete(c.peer); dropTile(c.peer + ':camera') }
          break
        }
      }
    })
    c.on('close', () => {
      timers.clearTimeout(timeout)
      if (connecting.get(c.peer) === c) connecting.delete(c.peer)
      if (conns.get(c.peer) !== member) return
      disconnectMember(c.peer)
    })
    c.on('error', () => c.close())
  }

  function callPeer(id: PeerId) {
    if (!stream || !peer.open || !connectedMember(id) || !conns.get(id)!.ready) return
    const call = peer.call(id, stream, { sdpTransform: preferH264 })
    calls.get(id)?.close()
    calls.set(id, call)
    void streaming.add(id, call)
    void streaming.setPreference(id, receiverPreferences.get(id) || 'primary')
    call.on('close', () => {
      if (calls.get(id) !== call) return
      calls.delete(id); void streaming.remove(id, call)
      // The data channel can survive while this media connection fails; try the screen again.
      timers.setTimeout(() => { if (!calls.has(id)) callPeer(id) }, MEDIA_RETRY_MS)
    })
    call.on('error', () => call.close())
    void streaming.refresh()
  }
  function sendPreferences() {
    const { focus, hidden, thumbnails } = viewing
    conns.forEach((member, id) => {
      if (!connectedMember(id) || !member.ready) return
      const preference: StreamPreference = hidden ? 'hidden' : (focus && focus !== id) || thumbnails.has(id) ? 'thumbnail' : 'primary'
      if (sentPreferences.get(member.channel) === preference) return
      sentPreferences.set(member.channel, preference)
      member.channel.send({ t: 'stream-preference', preference })
    })
  }

  function callCamera(id: PeerId) {
    if (!cameraStream || !peer.open || !connectedMember(id) || !conns.get(id)!.ready) return
    cameraCalls.get(id)?.close()
    const call = peer.call(id, cameraStream, { metadata: { kind: 'camera', session: cameraSession } })
    cameraCalls.set(id, call)
    call.on('close', () => {
      if (cameraCalls.get(id) !== call) return
      cameraCalls.delete(id)
      timers.setTimeout(() => { if (!cameraCalls.has(id)) callCamera(id) }, MEDIA_RETRY_MS)
    })
    call.on('error', () => call.close())
  }
  function stopCamera() {
    cameraCancelled++
    cameraSource?.stop(); cameraSource = null
    cameraVideo?.pause(); if (cameraVideo) cameraVideo.srcObject = null; cameraVideo = null
    cameraRaw?.getTracks().forEach(track => track.stop()); cameraRaw = null
    cameraStream?.getTracks().forEach(track => track.stop()); cameraStream = null
    cameraCalls.forEach(call => call.close()); cameraCalls.clear()
    conns.forEach(({ channel }) => { if (channel.open) channel.send({ t: 'camera-stop', session: cameraSession }) })
    tiles.delete('me:camera'); changed()
  }
  async function startCamera() {
    if (isEnded() || !roomEntered || cameraPending || cameraStream) return
    cameraPending = true; changed()
    const request = cameraCancelled
    const cancelled = () => request !== cameraCancelled || isEnded() || !roomEntered
    try {
      const raw = await media.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } }, audio: false })
      if (cancelled() || peer.destroyed) { raw.getTracks().forEach(track => track.stop()); return }
      cameraRaw = raw; cameraSession++
      const video = (media.createVideo ?? (() => document.createElement('video')))()
      cameraVideo = video; video.muted = true; video.playsInline = true; video.srcObject = raw
      await video.play()
      if (cancelled() || peer.destroyed) return
      cameraStream = raw
      const source = createCameraSource<MediaStream>({
        raw, video, createCanvas: media.createCanvas,
        schedule: (callback, ms) => timers.setInterval(callback, ms), cancel: handle => timers.clearInterval(handle),
        onTrack: async (_track, nextStream) => {
          if (cancelled()) return
          cameraStream = nextStream
          const track = nextStream.getVideoTracks()[0]
          await Promise.all([...cameraCalls.values()].map(async call => {
            const sender = call.peerConnection?.getSenders().find(item => item.track?.kind === 'video')
            if (!sender || !connectedMember(call.peer)) return
            try { await sender.replaceTrack(track) }
            catch { if (cameraCalls.get(call.peer) === call && connectedMember(call.peer)) callCamera(call.peer) }
          }))
          if (cancelled()) return
          addTile('me:camera', nextStream)
        },
      })
      cameraSource = source
      await source.setEffect(cameraEffect)
      if (cancelled()) return
      raw.getVideoTracks()[0].onended = stopCamera
      addTile('me:camera', cameraStream); conns.forEach((_, id) => callCamera(id))
    } catch (error) {
      stopCamera()
      const name = (error as { name?: unknown } | null)?.name
      notice(name === 'NotAllowedError' ? 'camera-not-allowed' : name === 'NotFoundError' ? 'camera-not-found' : 'camera-failed')
    } finally { cameraPending = false; changed() }
  }
  async function setCameraEffect(effect: CameraEffect) {
    cameraEffect = effect; changed()
    try { await cameraSource?.setEffect(effect) } catch { notice('camera-effect-failed') }
  }

  function shareScreen(profile: ScreenProfileName) {
    if (isEnded() || !roomEntered || stream || capturing) return
    requestedProfile = profile
    if (hubConn?.open) hubConn.send({ t: 'want' })
  }
  async function begin() {
    if (isEnded() || !roomEntered || stream || capturing) return
    capturing = true
    const profileName = requestedProfile, profile = SCREEN_PROFILES[profileName]
    screen = { status: 'starting', profile: profileName }; changed()
    void streaming.setProfile(profile)
    let capture
    try { capture = await captureScreen(media, profile) }
    catch {
      capturing = false; screen = { status: 'off' }; sharers.delete(myId!); hubConn?.send({ t: 'stop' }); changed(); return
    }
    stream = capture.stream
    if (isEnded() || !roomEntered) { stream.getTracks().forEach(track => track.stop()); stream = null; return }
    capturing = false
    stream.getVideoTracks()[0].onended = stopScreen
    screen = { status: 'live', profile: profileName, surface: capture.surface, hasAudio: capture.hasAudio }
    addTile('me', stream)
    conns.forEach((_, id) => callPeer(id))
  }
  function stopScreen() {
    if (!stream) return
    stream.getTracks().forEach(track => track.stop()); stream = null
    streaming.stop()
    calls.forEach(call => call.close()); calls.clear()
    conns.forEach(({ channel }) => channel.send({ t: 'stop' }))
    sharers.delete(myId!); hubConn?.send({ t: 'stop' })
    screen = { status: 'off' }; tiles.delete('me'); changed()
  }

  const toWire = (key: TileKey) => key === 'me' ? myId ?? key : key === 'me:camera' ? myId + ':camera' : key
  const fromWire = (id: string): TileKey => id === myId ? 'me' : id === myId + ':camera' ? 'me:camera' : id
  const broadcast = (message: FeatureMessage | ReturnType<typeof hello>) =>
    conns.forEach(({ channel }) => { if (connectedMember(channel.peer)) channel.send(message) })

  async function sampleCall(call: MediaCall) {
    const report = await call.peerConnection?.getStats().catch(() => null)
    if (!report) return null
    const result = readVideoStats(report, diagSamples.get(call))
    if (result) diagSamples.set(call, result)
    return result
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    onNotice(listener) { noticeListeners.add(listener); return () => { noticeListeners.delete(listener) } },
    onMessage(type, handler) {
      const set = handlers.get(type) ?? new Set()
      handlers.set(type, set)
      const entry = handler as (message: FeatureMessage, from: PeerId) => void
      set.add(entry)
      return () => { set.delete(entry) }
    },
    shareScreen, stopScreen, startCamera, stopCamera, setCameraEffect,
    setViewing(next) { viewing = { ...next, thumbnails: new Set(next.thumbnails) }; sendPreferences() },
    setName(name) {
      const next = name.trim().slice(0, NAME_LENGTH)
      if (!next) return
      myName = next; broadcast(hello()); changed()
    },
    setAway(next) { away = next; broadcast(hello()); changed() },
    announce: () => broadcast(hello()),
    send(id, message) { const member = conns.get(id); if (member?.channel.open && connectedMember(id)) member.channel.send(message) },
    broadcast,
    toWire, fromWire,
    async sampleStats() {
      const rows: Array<[TileKey, MediaCall[]]> = [...incomingScreens].map(([id, call]) => [id, [call]])
      if (calls.size) rows.push(['me', [...calls.values()]])
      const result = new Map<TileKey, VideoStats[]>()
      for (const [key, list] of rows) {
        const stats = (await Promise.all(list.map(sampleCall))).filter((value): value is VideoStats => !!value)
        if (stats.length) result.set(key, stats)
      }
      return result
    },
    leave: () => finishRoom('closed'),
  }
}
