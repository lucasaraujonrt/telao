import { expect, test } from 'vitest'
import { captureScreen, SCREEN_PROFILES, type CaptureDevices, type DisplayCaptureOptions } from './capture'

function fakeTrack(kind: 'audio' | 'video', displaySurface?: string) {
  return { kind, stopped: false, contentHint: '', stop() { this.stopped = true }, getSettings: () => ({ displaySurface }) }
}

function fakeDevices(surface: string) {
  const video = fakeTrack('video', surface), audio = fakeTrack('audio')
  let tracks = [video, audio]
  const requests: DisplayCaptureOptions[] = []
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter(track => track.kind === 'video'),
    getAudioTracks: () => tracks.filter(track => track.kind === 'audio'),
    removeTrack: (track: unknown) => { tracks = tracks.filter(item => item !== track) },
  } as unknown as MediaStream
  const devices: CaptureDevices = { getDisplayMedia: async options => { requests.push(options); return stream } }
  return { devices, requests, video, audio, stream }
}

test('screen capture asks Chrome to exclude system audio and keep window audio', async () => {
  const { devices, requests } = fakeDevices('window')
  await captureScreen(devices, SCREEN_PROFILES.game)
  expect(requests).toEqual([{
    video: { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 60, max: 60 } },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
    systemAudio: 'exclude',
    windowAudio: 'window',
    selfBrowserSurface: 'exclude',
  }])
})

test('each quality profile caps resolution and frame rate', async () => {
  for (const [name, size] of [['detail', [1920, 1080, 30]], ['light', [1280, 720, 30]]] as const) {
    const { devices, requests } = fakeDevices('window')
    await captureScreen(devices, SCREEN_PROFILES[name])
    const [width, height, fps] = size
    expect(requests[0].video).toEqual({ width: { ideal: width, max: width }, height: { ideal: height, max: height }, frameRate: { ideal: fps, max: fps } })
    expect(requests[0].systemAudio).toBe('exclude')
  }
})

test('a whole-screen capture stops and removes its audio so the Discord voice never leaks', async () => {
  const { devices, audio, video, stream } = fakeDevices('monitor')
  const capture = await captureScreen(devices, SCREEN_PROFILES.game)
  expect(audio.stopped).toBe(true)
  expect(stream.getAudioTracks()).toEqual([])
  expect(video.stopped).toBe(false)
  expect(capture).toMatchObject({ surface: 'monitor', hasAudio: false })
})

test.each(['window', 'browser'])('a %s capture keeps its own audio', async surface => {
  const { devices, audio } = fakeDevices(surface)
  const capture = await captureScreen(devices, SCREEN_PROFILES.game)
  expect(audio.stopped).toBe(false)
  expect(capture).toMatchObject({ surface, hasAudio: true })
})

test('the content hint follows the profile', async () => {
  const game = fakeDevices('window'), detail = fakeDevices('window')
  await captureScreen(game.devices, SCREEN_PROFILES.game)
  await captureScreen(detail.devices, SCREEN_PROFILES.detail)
  expect(game.video.contentHint).toBe('motion')
  expect(detail.video.contentHint).toBe('detail')
})
