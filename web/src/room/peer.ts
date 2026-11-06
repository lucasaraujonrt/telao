import type { StreamPeerConnection, VideoSender } from '../media/streaming'
import type { PeerId } from './protocol'

// The slice of PeerJS the room uses. The app passes PeerJS (see peerjs.ts); tests pass a fake network.

export interface WatchedConnection {
  readonly connectionState: string
  addEventListener(type: 'connectionstatechange', listener: () => void): void
}

export interface DataChannel {
  readonly peer: PeerId
  readonly open: boolean
  readonly peerConnection?: WatchedConnection | null
  send(message: unknown): void
  close(): void
  on(event: 'open' | 'close', listener: () => void): void
  on(event: 'data', listener: (data: unknown) => void): void
  on(event: 'error', listener: (error: unknown) => void): void
}

export interface MediaSender extends VideoSender {
  replaceTrack(track: MediaStreamTrack): Promise<void>
}

export interface CallConnection extends StreamPeerConnection {
  getSenders(): MediaSender[]
}

export interface MediaCall {
  readonly peer: PeerId
  readonly metadata?: unknown
  readonly peerConnection?: CallConnection | null
  answer(): void
  close(): void
  on(event: 'stream', listener: (stream: MediaStream) => void): void
  on(event: 'close', listener: () => void): void
  on(event: 'error', listener: (error: unknown) => void): void
}

export interface PeerError {
  readonly type: string
  readonly message?: string
}

export interface SignalPeer {
  readonly open: boolean
  readonly destroyed: boolean
  readonly disconnected: boolean
  connect(id: PeerId, options: { reliable: boolean }): DataChannel
  call(id: PeerId, stream: MediaStream, options: { metadata?: unknown; sdpTransform?: (sdp: string) => string }): MediaCall
  destroy(): void
  reconnect(): void
  on(event: 'open', listener: (id: PeerId) => void): void
  on(event: 'close' | 'disconnected', listener: () => void): void
  on(event: 'error', listener: (error: PeerError) => void): void
  on(event: 'connection', listener: (connection: DataChannel) => void): void
  on(event: 'call', listener: (call: MediaCall) => void): void
}

// `id` is undefined for the member peer (the server assigns one) and the directory id for the hub.
export type CreatePeer = (id: PeerId | undefined, options: { config: RTCConfiguration }) => SignalPeer
