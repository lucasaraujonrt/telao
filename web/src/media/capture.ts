export type ScreenProfileName = 'game' | 'detail' | 'light'

export interface ScreenProfile {
  width: number
  height: number
  fps: number
  bitrate: number
  motion: boolean
}

export const SCREEN_PROFILES: Record<ScreenProfileName, ScreenProfile> = {
  game: { width: 1280, height: 720, fps: 60, bitrate: 4_000_000, motion: true },
  detail: { width: 1920, height: 1080, fps: 30, bitrate: 3_000_000, motion: false },
  light: { width: 1280, height: 720, fps: 30, bitrate: 1_500_000, motion: true },
}

export interface DisplayCaptureOptions {
  video: MediaTrackConstraints
  audio: MediaTrackConstraints & { suppressLocalAudioPlayback: boolean }
  systemAudio: 'exclude'
  windowAudio: 'window'
  selfBrowserSurface: 'exclude'
}

export interface CaptureDevices {
  getDisplayMedia(options: DisplayCaptureOptions): Promise<MediaStream>
}

export type DisplaySurface = 'monitor' | 'window' | 'browser' | 'unknown'

export interface ScreenCapture {
  stream: MediaStream
  surface: DisplaySurface
  hasAudio: boolean
}

export function displayCaptureOptions(profile: ScreenProfile): DisplayCaptureOptions {
  return {
    video: { width: { ideal: profile.width, max: profile.width }, height: { ideal: profile.height, max: profile.height }, frameRate: { ideal: profile.fps, max: profile.fps } },
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
    // System audio would carry the Discord call. A tab's audio, or a program window's own
    // audio where Chrome can capture it, may go out; never the whole PC's.
    systemAudio: 'exclude',
    windowAudio: 'window',
    selfBrowserSurface: 'exclude',
  }
}

const surfaceOf = (track: MediaStreamTrack | undefined): DisplaySurface => {
  const surface = (track?.getSettings() as { displaySurface?: string } | undefined)?.displaySurface
  return surface === 'monitor' || surface === 'window' || surface === 'browser' ? surface : 'unknown'
}

export async function captureScreen(devices: CaptureDevices, profile: ScreenProfile): Promise<ScreenCapture> {
  const stream = await devices.getDisplayMedia(displayCaptureOptions(profile))
  const video = stream.getVideoTracks()[0]
  const surface = surfaceOf(video)
  // A whole screen's audio is the PC's audio, Discord included, even if Chrome offered it.
  if (surface === 'monitor') stream.getAudioTracks().forEach(track => { track.stop(); stream.removeTrack(track) })
  if (video) video.contentHint = profile.motion ? 'motion' : 'detail'
  return { stream, surface, hasAudio: stream.getAudioTracks().length > 0 }
}
