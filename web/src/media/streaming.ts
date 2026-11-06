import { browserTimers, type TimerHandle, type Timers } from './timers'

export type StreamPreference = 'primary' | 'thumbnail' | 'hidden'
export const STREAM_PREFERENCES: readonly StreamPreference[] = ['primary', 'thumbnail', 'hidden']

const weights: Record<StreamPreference, number> = { primary: 4, thumbnail: 1, hidden: 0.15 }

export interface StreamProfile {
  fps: number
  bitrate: number
  motion: boolean
}

export interface Encoding {
  maxBitrate: number
  maxFramerate: number
  scaleResolutionDownBy: number
  degradationPreference: 'maintain-framerate' | 'maintain-resolution'
}

export interface SenderParameters {
  encodings?: Array<Partial<Omit<Encoding, 'degradationPreference'>>>
  degradationPreference?: string
}

export interface VideoSender {
  readonly track: { readonly kind: string } | null
  getParameters(): SenderParameters
  setParameters(parameters: SenderParameters): Promise<void>
}

export interface StatsReport {
  forEach(callback: (stat: Record<string, any>) => void): void
}

export interface StreamPeerConnection {
  readonly connectionState?: string
  getSenders(): VideoSender[]
  getStats(): Promise<StatsReport>
  addEventListener?(type: 'connectionstatechange', listener: () => void): void
  removeEventListener?(type: 'connectionstatechange', listener: () => void): void
}

export interface StreamCall {
  readonly peerConnection?: StreamPeerConnection | null
  on?(event: 'close', listener: () => void): void
}

export interface RankedStream {
  peerId: string
  preference: StreamPreference
  rung: number
}

const defaultProfile: StreamProfile = { fps: 60, bitrate: 4_000_000, motion: true }

export function chooseEncoding(profile: StreamProfile, preference: StreamPreference, rung: number, budget: number): Encoding {
  const level = Math.max(0, Math.min(2, rung))
  const thumbnail = preference === 'thumbnail', hidden = preference === 'hidden'
  const scale = hidden ? 4 : thumbnail ? 3 : [1, 1.5, 2][level]
  const ceiling = hidden ? 120_000 : thumbnail ? 600_000 : profile.bitrate * [1, 0.65, 0.4][level]
  return {
    maxBitrate: Math.max(0, Math.floor(Math.min(budget, ceiling))),
    maxFramerate: Math.min(profile.fps, hidden ? 2 : thumbnail ? 15 : level ? 30 : profile.fps),
    scaleResolutionDownBy: scale,
    degradationPreference: profile.motion ? 'maintain-framerate' : 'maintain-resolution',
  }
}

export function allocateEncodings(profile: StreamProfile, streams: readonly RankedStream[], uploadBudget: number): Map<string, Encoding> {
  const weight = streams.reduce((sum, stream) => sum + weights[stream.preference], 0)
  return new Map(streams.map(stream => [stream.peerId, chooseEncoding(profile, stream.preference, stream.rung,
    Math.floor(uploadBudget * weights[stream.preference] / weight))]))
}

interface StreamState extends RankedStream {
  call: StreamCall
  pressure: number
  healthy: number
  queue: Promise<void>
  applied: WeakMap<VideoSender, string>
  omitDegradation: boolean
  desired: Encoding | null
  connected: () => void
}

export interface StreamController {
  setProfile(profile: StreamProfile): Promise<unknown>
  add(peerId: string, call: StreamCall): Promise<unknown>
  setPreference(peerId: string, preference: string): Promise<unknown>
  remove(peerId: string, call?: StreamCall): Promise<unknown>
  stop(): void
  refresh(): Promise<unknown>
  sample(): Promise<unknown>
}

const errorName = (error: unknown) => (error as { name?: unknown } | null)?.name

export function createStreamController({ uploadBudget = 8_000_000, sampleInterval = 3000, timers = browserTimers }: { uploadBudget?: number; sampleInterval?: number; timers?: Timers } = {}): StreamController {
  if (!Number.isFinite(uploadBudget) || uploadBudget < 1 || !Number.isFinite(sampleInterval) || sampleInterval < 0) throw new TypeError('Invalid stream budget or interval')
  const streams = new Map<string, StreamState>()
  let profile = defaultProfile, timer: TimerHandle | null = null, sampling = false
  const current = (state: StreamState) => streams.get(state.peerId) === state
  const settle = () => Promise.all([...streams.values()].map(state => state.queue))

  function schedule() {
    if (timer !== null || sampling || !streams.size || !sampleInterval) return
    timer = timers.setTimeout(() => { timer = null; void sample() }, sampleInterval)
  }

  async function apply(state: StreamState) {
    if (!current(state)) return
    const senders = state.call.peerConnection?.getSenders().filter(sender => sender.track?.kind === 'video') || []
    for (const sender of senders) {
      if (!current(state)) return
      const desired = state.desired
      if (!desired) continue
      const key = JSON.stringify(desired)
      if (state.applied.get(sender) === key) continue
      try {
        const parameters = sender.getParameters()
        if (!parameters.encodings?.length) continue
        const update = (parameters: SenderParameters) => {
          const encodings = parameters.encodings ?? []
          for (const encoding of encodings) {
            encoding.maxBitrate = Math.max(0, Math.floor(desired.maxBitrate / senders.length / encodings.length))
            encoding.maxFramerate = desired.maxFramerate
            encoding.scaleResolutionDownBy = desired.scaleResolutionDownBy
          }
          if (!state.omitDegradation) parameters.degradationPreference = desired.degradationPreference
          else delete parameters.degradationPreference
        }
        update(parameters)
        try { await sender.setParameters(parameters) }
        catch (error) {
          if (!current(state) || state.omitDegradation || !['TypeError', 'NotSupportedError'].includes(String(errorName(error)))) continue
          state.omitDegradation = true
          const fresh = sender.getParameters()
          if (!fresh.encodings?.length) continue
          update(fresh)
          await sender.setParameters(fresh)
        }
        if (current(state)) state.applied.set(sender, key)
      } catch { /* a failed update stays contained to this sender */ }
    }
  }

  function refresh() {
    const encodings = allocateEncodings(profile, [...streams.values()], uploadBudget)
    for (const state of streams.values()) {
      state.desired = encodings.get(state.peerId) ?? null
      state.queue = state.queue.then(() => apply(state)).catch(() => {})
    }
    return settle()
  }

  async function sample() {
    if (sampling) return settle()
    sampling = true
    try {
      await Promise.all([...streams.values()].map(async state => {
        if (!current(state)) return
        try {
          const report = await state.call.peerConnection?.getStats()
          if (!current(state) || !report) return
          let observed = false, pressure = false
          report.forEach(stat => {
            if (stat.type !== 'outbound-rtp' || stat.isRemote || (stat.kind || stat.mediaType) !== 'video') return
            if (['none', 'cpu', 'bandwidth'].includes(stat.qualityLimitationReason)) observed = true
            if (['cpu', 'bandwidth'].includes(stat.qualityLimitationReason)) pressure = true
          })
          if (!observed) { state.pressure = 0; state.healthy = 0; return }
          state.pressure = pressure ? state.pressure + 1 : 0
          state.healthy = pressure ? 0 : state.healthy + 1
          if (state.pressure >= 3) { state.rung = Math.min(2, state.rung + 1); state.pressure = 0 }
          if (state.healthy >= 6) { state.rung = Math.max(0, state.rung - 1); state.healthy = 0 }
        } catch { state.pressure = 0; state.healthy = 0 }
      }))
      return await refresh()
    } finally { sampling = false; schedule() }
  }

  function remove(peerId: string, call?: StreamCall) {
    const state = streams.get(peerId)
    if (!state || (call && state.call !== call)) return settle()
    state.call.peerConnection?.removeEventListener?.('connectionstatechange', state.connected)
    streams.delete(peerId)
    if (!streams.size && timer !== null) { timers.clearTimeout(timer); timer = null }
    return refresh()
  }

  function add(peerId: string, call: StreamCall) {
    if (streams.get(peerId)?.call === call) return refresh()
    void remove(peerId)
    const state: StreamState = {
      peerId, call, preference: 'primary', rung: 0, pressure: 0, healthy: 0, queue: Promise.resolve(),
      applied: new WeakMap(), omitDegradation: false, desired: null, connected: () => {},
    }
    state.connected = () => {
      if (!current(state)) return
      const connectionState = call.peerConnection?.connectionState
      if (connectionState === 'closed' || connectionState === 'failed') void remove(peerId, call)
      else if (connectionState === 'connected') { state.applied = new WeakMap(); void refresh() }
    }
    streams.set(peerId, state)
    call.peerConnection?.addEventListener?.('connectionstatechange', state.connected)
    call.on?.('close', () => void remove(peerId, call))
    schedule()
    return refresh()
  }

  function setProfile(next: StreamProfile) {
    if (!next || !Number.isFinite(next.fps) || next.fps < 1 || !Number.isFinite(next.bitrate) || next.bitrate < 1) throw new TypeError('Invalid stream profile')
    profile = { fps: next.fps, bitrate: next.bitrate, motion: !!next.motion }
    for (const state of streams.values()) { state.rung = 0; state.pressure = 0; state.healthy = 0 }
    return refresh()
  }

  function setPreference(peerId: string, preference: string) {
    if (!(STREAM_PREFERENCES as readonly string[]).includes(preference)) return settle()
    const state = streams.get(peerId)
    if (!state || state.preference === preference) return settle()
    state.preference = preference as StreamPreference
    return refresh()
  }

  function stop() {
    for (const state of streams.values()) state.call.peerConnection?.removeEventListener?.('connectionstatechange', state.connected)
    streams.clear()
    if (timer !== null) timers.clearTimeout(timer)
    timer = null
  }

  return { setProfile, add, setPreference, remove, stop, refresh, sample }
}

// Chrome offers VP8 first, which most PCs encode and decode on the CPU. H.264 usually runs on
// the graphics chip, so moving it to the front of the video line cuts CPU for sharer and viewers.
// Every other codec stays in the offer, so a browser without H.264 still connects.
export function preferH264<T>(sdp: T): T {
  if (typeof sdp !== 'string') return sdp
  const eol = sdp.includes('\r\n') ? '\r\n' : '\n'
  const lines = sdp.split(eol)
  const start = lines.findIndex(line => line.startsWith('m=video '))
  if (start < 0) return sdp
  const end = lines.findIndex((line, i) => i > start && line.startsWith('m='))
  const section = lines.slice(start, end < 0 ? lines.length : end)
  const h264 = new Set<string>()
  for (const line of section) {
    const match = /^a=rtpmap:(\d+) H264\//.exec(line)
    if (match) h264.add(match[1])
  }
  if (!h264.size) return sdp
  // Constrained baseline (42e0xx) is the profile hardware handles best, so it leads the H.264 group.
  const baseline = new Set<string>()
  for (const line of section) {
    const match = /^a=fmtp:(\d+) .*profile-level-id=42e0/i.exec(line)
    if (match && h264.has(match[1])) baseline.add(match[1])
  }
  const parts = lines[start].split(' ')
  const payloads = parts.slice(3)
  const rank = (pt: string) => baseline.has(pt) ? 0 : h264.has(pt) ? 1 : 2
  const sorted = payloads.map((pt, i) => [pt, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([pt]) => pt)
  lines[start] = [...parts.slice(0, 3), ...sorted].join(' ')
  return lines.join(eol) as T
}

export interface VideoStats {
  id: string
  timestamp: number
  bytes: number
  sending: boolean
  codec: string | null
  implementation: string | null
  hardware: boolean | null
  fps: number | null
  width: number | null
  height: number | null
  kbps: number | null
  limit: string | null
}

// Reads the main video stream of one connection out of a getStats() report. Pass the previous
// result back in to get the bitrate between the two samples.
export function readVideoStats(report: StatsReport, previous?: VideoStats | null): VideoStats | null {
  const codecs = new Map<string, string>(), rtps: Array<Record<string, any>> = []
  report.forEach(stat => {
    if (stat.type === 'codec') codecs.set(stat.id, stat.mimeType)
    else if ((stat.type === 'outbound-rtp' || stat.type === 'inbound-rtp') && !stat.isRemote && (stat.kind || stat.mediaType) === 'video') rtps.push(stat)
  })
  const rtp = rtps.sort((a, b) => (b.frameWidth || 0) - (a.frameWidth || 0))[0]
  if (!rtp) return null
  const sending = rtp.type === 'outbound-rtp'
  const bytes: number = (sending ? rtp.bytesSent : rtp.bytesReceived) || 0
  const before = previous && previous.id === rtp.id && rtp.timestamp > previous.timestamp ? previous : null
  const implementation: string | null = (sending ? rtp.encoderImplementation : rtp.decoderImplementation) || null
  const efficient = sending ? rtp.powerEfficientEncoder : rtp.powerEfficientDecoder
  // Chrome hides these two fields unless the page is capturing, so both can be missing.
  const hardware = typeof efficient === 'boolean' ? efficient
    : implementation ? !/libvpx|openh264|dav1d|libaom|ffmpeg|fallback/i.test(implementation) : null
  return {
    id: rtp.id, timestamp: rtp.timestamp, bytes, sending,
    codec: (codecs.get(rtp.codecId) || '').replace(/^video\//i, '') || null,
    implementation, hardware,
    fps: Number.isFinite(rtp.framesPerSecond) ? Math.round(rtp.framesPerSecond) : null,
    width: rtp.frameWidth || null, height: rtp.frameHeight || null,
    kbps: before ? Math.max(0, Math.round((bytes - before.bytes) * 8 / (rtp.timestamp - before.timestamp))) : null,
    limit: sending ? rtp.qualityLimitationReason || null : null,
  }
}
