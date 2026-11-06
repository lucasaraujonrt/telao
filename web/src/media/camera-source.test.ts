import { expect, test } from 'vitest'
import { createCameraSource, type CameraCanvas } from './camera-source'

interface FakeTrack { stopped: boolean; stop(): void }
interface FakeStream { getVideoTracks(): FakeTrack[]; getTracks(): FakeTrack[] }

function setup(onTrack: (track: unknown, stream: FakeStream) => Promise<void> | void = async () => {}) {
  const output = { canvases: 0, drawings: 0, timers: new Set<unknown>(), tracks: [] as FakeTrack[] }
  const track = () => {
    const result: FakeTrack = { stopped: false, stop() { this.stopped = true } }
    output.tracks.push(result)
    return result
  }
  const stream = (value: FakeTrack): FakeStream => ({ getVideoTracks: () => [value], getTracks: () => [value] })
  const raw = stream(track())
  const source = createCameraSource({
    raw, video: {}, onTrack,
    createCanvas(): CameraCanvas {
      output.canvases++
      return {
        getContext: () => ({ save() {}, restore() {}, drawImage() { output.drawings++ }, fillRect() {}, fillText() {} }),
        captureStream: () => stream(track()),
      }
    },
    schedule(callback) { output.timers.add(callback); return callback },
    cancel(callback) { output.timers.delete(callback) },
  })
  return { source, output, raw }
}

test('normal camera uses the original stream without allocating or drawing a canvas', async () => {
  const { source, output, raw } = setup()
  await source.setEffect('normal')
  expect(source.getStream()).toBe(raw)
  expect(output.canvases).toBe(0)
  expect(output.drawings).toBe(0)
  expect(output.timers.size).toBe(0)
})

test('returning to normal stops the effect track and drawing without stopping the camera', async () => {
  const sent: FakeStream[] = []
  const { source, output, raw } = setup(async (_track, stream) => { sent.push(stream) })
  await source.setEffect('mono')
  const effectTrack = source.getStream().getVideoTracks()[0]
  expect(output.timers.size).toBe(1)
  await source.setEffect('neon')
  expect(output.timers.size).toBe(1)
  await source.setEffect('normal')
  expect(source.getStream()).toBe(raw)
  expect(effectTrack.stopped).toBe(true)
  expect(raw.getVideoTracks()[0].stopped).toBe(false)
  expect(output.timers.size).toBe(0)
  expect(sent.length).toBe(2)
})

test('effect changes wait for track replacement and preserve their order', async () => {
  let release: (() => void) | undefined
  const replaced: FakeStream[] = []
  const { source, output, raw } = setup(async (_track, stream) => {
    replaced.push(stream)
    if (replaced.length === 1) await new Promise<void>(resolve => { release = resolve })
  })
  const first = source.setEffect('pixel')
  const second = source.setEffect('normal')
  await Promise.resolve()
  expect(replaced.length).toBe(1)
  release!()
  await Promise.all([first, second])
  expect(replaced[1]).toBe(raw)
  expect(output.timers.size).toBe(0)
})

test('stopping during replacement disposes the new effect and never starts a drawing loop', async () => {
  let release: (() => void) | undefined
  const { source, output } = setup(() => new Promise<void>(resolve => { release = resolve }))
  const pending = source.setEffect('mono')
  await Promise.resolve()
  source.stop(); release!(); await pending
  expect(output.tracks[1].stopped).toBe(true)
  expect(output.timers.size).toBe(0)
  await source.setEffect('vhs')
  expect(output.tracks.length).toBe(2)
})

test('failed replacement releases the unused effect and allows a later retry', async () => {
  let fail = true
  const { source, output, raw } = setup(async () => { if (fail) throw Error('replacement failed') })
  await expect(source.setEffect('mono')).rejects.toThrow(/replacement failed/)
  expect(output.tracks[1].stopped).toBe(true)
  expect(source.getStream()).toBe(raw)
  fail = false
  await source.setEffect('mono')
  expect(source.getStream()).not.toBe(raw)
  source.stop()
})

test('failed canvas capture can retry the same effect without leaving a drawing loop', async () => {
  let attempts = 0
  const context = { save() {}, restore() {}, drawImage() {} }
  const raw = { getVideoTracks: () => [{ stop() {} }] }
  const processed = { getVideoTracks: () => [{ stop() {} }], getTracks: () => [] }
  const source = createCameraSource({
    raw, video: {}, onTrack: async () => {},
    createCanvas: () => ({
      getContext: () => context,
      captureStream() {
        if (++attempts === 1) throw Error('Capture unavailable')
        return processed
      },
    }),
    schedule: () => 1, cancel: () => {},
  })
  await expect(source.setEffect('mono')).rejects.toThrow(/Capture unavailable/)
  expect(source.getStream()).toBe(raw)
  await source.setEffect('mono')
  expect(attempts).toBe(2)
  expect(source.getStream()).toBe(processed)
  source.stop()
})
