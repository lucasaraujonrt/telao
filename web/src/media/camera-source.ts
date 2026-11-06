export type CameraEffect = 'normal' | 'mono' | 'vhs' | 'neon' | 'pixel'
export const CAMERA_EFFECTS: readonly CameraEffect[] = ['normal', 'mono', 'vhs', 'neon', 'pixel']

export interface CameraTrack { stop(): void }
export interface CameraStream {
  getVideoTracks(): CameraTrack[]
  getTracks?(): CameraTrack[]
}

interface Context2D {
  save(): void
  restore(): void
  drawImage(image: unknown, x: number, y: number, width: number, height: number): void
  fillRect?(x: number, y: number, width: number, height: number): void
  fillText?(text: string, x: number, y: number): void
  filter?: string
  imageSmoothingEnabled?: boolean
  fillStyle?: unknown
  font?: string
}

export interface CameraCanvas {
  width?: number
  height?: number
  getContext(type: '2d', options?: { alpha: boolean }): Context2D | null
  captureStream(fps: number): CameraStream
}

export interface CameraSourceOptions<S extends CameraStream> {
  raw: S
  video: unknown
  onTrack(track: CameraTrack, stream: S): Promise<void> | void
  createCanvas?: () => CameraCanvas
  schedule?: (callback: () => void, ms: number) => unknown
  cancel?: (handle: unknown) => void
}

export interface CameraSource<S> {
  setEffect(value: string): Promise<void>
  stop(): void
  getStream(): S
}

const stopAll = (stream: CameraStream) => stream.getTracks?.().forEach(track => track.stop())

export function createCameraSource<S extends CameraStream>({
  raw, video, onTrack,
  createCanvas = () => document.createElement('canvas') as unknown as CameraCanvas,
  schedule = (callback, ms) => setInterval(callback, ms),
  cancel = handle => clearInterval(handle as number),
}: CameraSourceOptions<S>): CameraSource<S> {
  let active: S = raw, processed: S | null = null, timer: unknown = null, disposed = false, effect: CameraEffect = 'normal'
  let queue: Promise<void> = Promise.resolve()
  let canvas: CameraCanvas | undefined, context: Context2D, small: CameraCanvas, tiny: Context2D

  function clearDrawing() {
    if (timer !== null) cancel(timer)
    timer = null
  }

  function draw() {
    context.save()
    context.filter = effect === 'mono' ? 'grayscale(1) contrast(1.2)' : effect === 'vhs' ? 'sepia(.4) saturate(1.5) contrast(1.1)' : effect === 'neon' ? 'hue-rotate(275deg) saturate(2.8) contrast(1.3)' : 'none'
    if (effect === 'pixel') {
      tiny.drawImage(video, 0, 0, 80, 60)
      context.imageSmoothingEnabled = false
      context.drawImage(small, 0, 0, 640, 480)
    } else {
      context.imageSmoothingEnabled = true
      context.drawImage(video, 0, 0, 640, 480)
    }
    context.restore()
    if (effect === 'vhs') {
      context.fillStyle = 'rgba(0,0,0,.18)'
      for (let y = 0; y < 480; y += 4) context.fillRect?.(0, y, 640, 1)
      context.fillStyle = 'white'; context.font = 'bold 20px monospace'
      context.fillText?.('REC ● TROPA CAM', 20, 32)
    }
  }

  function setEffect(value: string) {
    const nextEffect: CameraEffect = (CAMERA_EFFECTS as readonly string[]).includes(value) ? value as CameraEffect : 'normal'
    const operation = queue.then(async () => {
      if (disposed || nextEffect === effect) return
      if (nextEffect !== 'normal' && !canvas) {
        canvas = createCanvas(); canvas.width = 640; canvas.height = 480
        context = canvas.getContext('2d', { alpha: false })!
        small = createCanvas(); small.width = 80; small.height = 60
        tiny = small.getContext('2d')!
      }
      if (nextEffect !== 'normal' && processed) {
        effect = nextEffect
        return
      }
      let next: S = raw
      const previousEffect = effect
      try {
        if (nextEffect !== 'normal') {
          effect = nextEffect; draw()
          next = canvas!.captureStream(24) as S
        }
        await onTrack(next.getVideoTracks()[0], next)
      } catch (error) {
        if (next !== raw) stopAll(next)
        effect = previousEffect
        throw error
      }
      if (disposed) {
        if (next !== raw) stopAll(next)
        return
      }
      clearDrawing()
      if (processed) stopAll(processed)
      processed = next === raw ? null : next
      active = next; effect = nextEffect
      if (processed) timer = schedule(draw, 1000 / 24)
    })
    queue = operation.catch(() => {})
    return operation
  }

  function stop() {
    disposed = true; clearDrawing()
    if (processed) stopAll(processed)
    processed = null
  }

  return { setEffect, stop, getStream: () => active }
}
