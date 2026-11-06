import { expect, test } from 'vitest'
import { allocateEncodings, createStreamController, preferH264, readVideoStats, type SenderParameters, type StatsReport, type VideoSender } from './streaming'

const profile = { fps: 60, bitrate: 4_000_000, motion: true }

type Applied = SenderParameters & { transactionId?: string }

function fakeCall() {
  const listeners = new Map<string, () => void>()
  let reason: string | undefined = 'none', version = 0
  const applied: Applied[] = [], transactionErrors: Array<{ received?: string; expected: string }> = []
  const sender: VideoSender = {
    track: { kind: 'video' },
    getParameters: () => ({ transactionId: String(++version), encodings: [{}] }) as Applied,
    async setParameters(parameters: Applied) {
      if (parameters.transactionId !== String(version)) transactionErrors.push({ received: parameters.transactionId, expected: String(version) })
      applied.push(structuredClone(parameters))
    },
  }
  const pc = {
    connectionState: 'connected',
    getSenders: (): VideoSender[] => [sender],
    getStats: async (): Promise<StatsReport> => new Map([['video', { type: 'outbound-rtp', kind: 'video', qualityLimitationReason: reason }]]),
    addEventListener: (event: string, listener: () => void) => { listeners.set(event, listener) },
    removeEventListener: (event: string, listener: () => void) => { if (listeners.get(event) === listener) listeners.delete(event) },
  }
  return { peerConnection: pc, sender, applied, listeners, transactionErrors, reason(value: string | undefined) { reason = value } }
}

const last = (call: ReturnType<typeof fakeCall>) => call.applied.at(-1)!.encodings![0]

test('screen allocations stay within budget and preserve primary quality over thumbnails', () => {
  const streams = Array.from({ length: 8 }, (_, i) => ({ peerId: String(i), preference: i ? 'thumbnail' as const : 'primary' as const, rung: 0 }))
  const result = allocateEncodings(profile, streams, 8_000_000)
  expect([...result.values()].reduce((sum, value) => sum + value.maxBitrate, 0)).toBeLessThanOrEqual(8_000_000)
  expect(result.get('0')!.maxBitrate).toBeGreaterThan(result.get('1')!.maxBitrate)
  expect(result.get('0')!.maxFramerate).toBe(60)
  expect(result.get('1')!.maxFramerate).toBe(15)
  expect([...allocateEncodings(profile, streams, 1).values()].reduce((sum, value) => sum + value.maxBitrate, 0)).toBeLessThanOrEqual(1)
})

test('sustained pressure reduces quality and recovery needs six observed healthy samples', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const call = fakeCall()
  await controller.add('a', call)
  call.reason('cpu')
  await controller.sample(); await controller.sample()
  expect(last(call).scaleResolutionDownBy).toBe(1)
  await controller.sample()
  expect(last(call).scaleResolutionDownBy).toBe(1.5)
  call.reason(undefined)
  for (let i = 0; i < 10; i++) await controller.sample()
  expect(last(call).scaleResolutionDownBy).toBe(1.5)
  call.reason('none')
  for (let i = 0; i < 5; i++) await controller.sample()
  expect(last(call).scaleResolutionDownBy).toBe(1.5)
  await controller.sample()
  expect(last(call).scaleResolutionDownBy).toBe(1)
  controller.stop()
})

test('preferences change only video parameters and unchanged refresh does not renegotiate', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const call = fakeCall()
  let audioReads = 0, audioWrites = 0
  const audio: VideoSender = {
    track: { kind: 'audio' },
    getParameters() { audioReads++; return { encodings: [{}] } },
    async setParameters() { audioWrites++ },
  }
  call.peerConnection.getSenders = () => [call.sender, audio]
  await controller.add('a', call)
  await controller.refresh()
  expect(call.applied.length).toBe(1)
  await controller.setPreference('a', 'hidden')
  expect(last(call).maxFramerate).toBe(2)
  expect(last(call).maxBitrate).toBeLessThanOrEqual(120_000)
  expect(audioReads).toBe(0)
  expect(audioWrites).toBe(0)
  expect(call.transactionErrors).toEqual([])
  controller.stop()
})

test('concurrent preference changes serialize sender transactions and settle at latest target', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const call = fakeCall()
  let release: (() => void) | undefined, active = 0, concurrentWrites = 0
  const original = call.sender.setParameters
  call.sender.setParameters = async parameters => {
    active++
    if (active > 1) concurrentWrites++
    if (!release) await new Promise<void>(resolve => { release = resolve })
    await original(parameters)
    active--
  }
  const first = controller.add('a', call)
  await Promise.resolve()
  const second = controller.setPreference('a', 'thumbnail')
  const third = controller.setPreference('a', 'hidden')
  release!()
  await Promise.all([first, second, third])
  expect(last(call).maxFramerate).toBe(2)
  expect(concurrentWrites).toBe(0)
  expect(active).toBe(0)
  expect(call.transactionErrors).toEqual([])
  controller.stop()
})

test('removed and replaced calls cannot receive later queued settings or delete replacement', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const old = fakeCall(), next = fakeCall()
  const pending = controller.add('a', old)
  const replaced = controller.add('a', next)
  await Promise.all([pending, replaced])
  expect(old.applied.length).toBe(0)
  await controller.remove('a', old)
  await controller.setPreference('a', 'thumbnail')
  expect(last(next).maxFramerate).toBe(15)
  await controller.remove('a', next)
  await controller.refresh()
  expect(next.listeners.size).toBe(0)
  controller.stop()
})

test('unsupported degradation retries with fresh parameters and later failures remain contained', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const call = fakeCall()
  const original = call.sender.setParameters
  let rejected = false
  call.sender.setParameters = async parameters => {
    if (parameters.degradationPreference) { rejected = true; throw new TypeError('Unsupported') }
    await original(parameters)
  }
  await controller.add('a', call)
  expect(rejected).toBe(true)
  expect(call.applied.length).toBe(1)
  expect('degradationPreference' in call.applied[0]).toBe(false)
  expect(call.transactionErrors).toEqual([])
  call.sender.setParameters = async () => { throw new Error('Connection closed') }
  await controller.setPreference('a', 'hidden')
  controller.stop()
})

test('removing a call during an in-flight update cancels its follow-up work', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const call = fakeCall(), next = fakeCall()
  const original = call.sender.setParameters
  let release: (() => void) | undefined, updates = 0
  call.sender.setParameters = async parameters => {
    updates++
    await new Promise<void>(resolve => { release = resolve })
    await original(parameters)
  }
  const pending = controller.add('a', call)
  await Promise.resolve()
  const preference = controller.setPreference('a', 'thumbnail')
  const replacement = controller.add('a', next)
  release!()
  await Promise.all([pending, preference, replacement])
  expect(updates).toBe(1)
  expect(last(next).maxFramerate).toBe(60)
  controller.stop()
})

test('empty negotiation parameters retry on connected state and sampling does not overlap', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const call = fakeCall()
  const parameters = call.sender.getParameters
  call.sender.getParameters = () => ({ encodings: [] })
  await controller.add('a', call)
  expect(call.applied.length).toBe(0)
  call.sender.getParameters = parameters
  call.listeners.get('connectionstatechange')!()
  await controller.refresh()
  expect(call.applied.length).toBe(1)
  let reads = 0, release: ((report: StatsReport) => void) | undefined
  call.peerConnection.getStats = () => { reads++; return new Promise<StatsReport>(resolve => { release = resolve }) }
  const first = controller.sample()
  const second = controller.sample()
  expect(reads).toBe(1)
  release!(new Map())
  await Promise.all([first, second])
  controller.stop()
})

test('stop is reusable and cancels queued work', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const old = fakeCall()
  const pending = controller.add('a', old)
  controller.stop()
  await pending
  expect(old.applied.length).toBe(0)
  const next = fakeCall()
  await controller.add('b', next)
  expect(next.applied.length).toBe(1)
  controller.stop()
})

test('a rejected pending update does not hide concurrent writes or poison later queued updates', async () => {
  const controller = createStreamController({ sampleInterval: 0 })
  const call = fakeCall()
  const original = call.sender.setParameters
  let release: (() => void) | undefined, active = 0, concurrentWrites = 0, writes = 0, failures = 0
  call.sender.setParameters = async parameters => {
    writes++
    active++
    if (active > 1) concurrentWrites++
    try {
      if (writes === 1) {
        await new Promise<void>(resolve => { release = resolve })
        failures++
        throw new Error('Temporary encoder failure')
      }
      await original(parameters)
    } finally { active-- }
  }
  const first = controller.add('a', call)
  await Promise.resolve()
  const second = controller.setPreference('a', 'thumbnail')
  const third = controller.setPreference('a', 'hidden')
  release!()
  await Promise.all([first, second, third])
  expect(failures).toBe(1)
  expect(writes).toBe(2)
  expect(concurrentWrites).toBe(0)
  expect(active).toBe(0)
  expect(call.transactionErrors).toEqual([])
  expect(call.applied.length).toBe(1)
  expect(call.applied[0].encodings![0].maxFramerate).toBe(2)
  controller.stop()
})

test('preferH264 moves H.264 ahead of VP8 and keeps every codec', () => {
  const sdp = ['v=0', 'm=audio 9 UDP/TLS/RTP/SAVPF 111', 'a=rtpmap:111 opus/48000/2',
    'm=video 9 UDP/TLS/RTP/SAVPF 96 97 102 103 104',
    'a=rtpmap:96 VP8/90000', 'a=rtpmap:97 rtx/90000',
    'a=rtpmap:102 H264/90000', 'a=fmtp:102 profile-level-id=640c1f;packetization-mode=1',
    'a=rtpmap:103 H264/90000', 'a=fmtp:103 profile-level-id=42e01f;packetization-mode=1',
    'a=rtpmap:104 rtx/90000', ''].join('\r\n')
  const out = preferH264(sdp)
  expect(out).toMatch(/m=video 9 UDP\/TLS\/RTP\/SAVPF 103 102 96 97 104\r\n/)
  expect(out).toMatch(/m=audio 9 UDP\/TLS\/RTP\/SAVPF 111\r\n/)
  expect(preferH264('m=video 9 X 96\r\na=rtpmap:96 VP8/90000\r\n')).toBe('m=video 9 X 96\r\na=rtpmap:96 VP8/90000\r\n')
  expect(preferH264(undefined)).toBe(undefined)
})

test('readVideoStats reports codec, hardware, fps, limit and bitrate between samples', () => {
  const report = (bytes: number, timestamp: number) => new Map<string, Record<string, unknown>>([
    ['c1', { type: 'codec', id: 'c1', mimeType: 'video/H264' }],
    ['a', { type: 'outbound-rtp', id: 'a', kind: 'audio', bytesSent: 999 }],
    ['v', { type: 'outbound-rtp', id: 'v', kind: 'video', codecId: 'c1', bytesSent: bytes, timestamp, framesPerSecond: 59.6, frameWidth: 1280, frameHeight: 720, encoderImplementation: 'ExternalEncoder', qualityLimitationReason: 'cpu' }],
  ])
  const first = readVideoStats(report(0, 1000))!
  expect(first.kbps).toBe(null)
  const second = readVideoStats(report(500_000, 2000), first)!
  expect({ codec: second.codec, hardware: second.hardware, fps: second.fps, width: second.width, kbps: second.kbps, limit: second.limit, sending: second.sending })
    .toEqual({ codec: 'H264', hardware: true, fps: 60, width: 1280, kbps: 4000, limit: 'cpu', sending: true })
  const software = new Map([['v', { type: 'inbound-rtp', id: 'v', kind: 'video', bytesReceived: 1, timestamp: 1, decoderImplementation: 'libvpx' }]])
  expect(readVideoStats(software)!.hardware).toBe(false)
  expect(readVideoStats(software)!.limit).toBe(null)
  expect(readVideoStats(new Map())).toBe(null)
})
