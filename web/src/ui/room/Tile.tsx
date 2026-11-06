import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Maximize, Minimize, Moon, MonitorOff, RectangleHorizontal, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import type { DiagnosticRow } from '@/lib/format'
import type { Tile as TileData } from '../../room/room'
import { Tip } from '../tip'

export interface TileAudio { muted: boolean; volume: number }

export interface TileProps {
  tile: TileData
  label: string
  away: boolean
  audio: TileAudio
  deaf: boolean
  mirror: boolean
  diagnostics: DiagnosticRow[] | null
  /** In the theater strip: no controls, just the picture and the name. */
  thumbnail?: boolean
  fullscreen: boolean
  theater: boolean
  canTheater: boolean
  lights?: boolean
  onAudio: (next: TileAudio) => void
  onBlocked: () => void
  onFullscreen: () => void
  onTheater: () => void
  onStop?: () => void
}

/** One stream: a screen or a camera. Every tile starts muted; the core never tells us about sound. */
export function Tile(props: TileProps) {
  const { tile, label, away, audio, deaf, mirror, diagnostics, thumbnail, fullscreen, theater, canTheater } = props
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const mine = tile.owner === 'me'
  const screen = tile.kind === 'screen'
  const muted = deaf || audio.muted
  const hasAudio = tile.stream.getAudioTracks().length > 0
  // You never hear your own share; a camera without sound has nothing to mute.
  const volumeControl = !mine && !thumbnail && (screen || hasAudio)
  const blocked = useEffectEvent(() => props.onBlocked())

  useEffect(() => {
    const element = video.current
    if (!element) return
    element.srcObject = tile.stream
    setPlaying(false)
    return () => { element.srcObject = null }
  }, [tile.stream])

  useEffect(() => {
    const element = video.current
    if (!element) return
    element.muted = mine || muted
    element.volume = audio.volume
    element.play().catch((error: unknown) => {
      if ((error as { name?: string } | null)?.name !== 'NotAllowedError') return
      element.muted = true
      blocked()
      void element.play().catch(() => {})
    })
  }, [tile.stream, mine, muted, audio.volume])

  return (
    <div
      data-tile-key={tile.key}
      className={cn(
        'tile on-video group/tile relative size-full overflow-hidden bg-stage',
        fullscreen ? 'rounded-none' : 'rounded-[12px]',
        !playing && 'bg-surface-2',
      )}
      onDoubleClick={thumbnail ? undefined : props.onFullscreen}
    >
      <video
        ref={video}
        autoPlay
        playsInline
        muted
        onPlaying={() => setPlaying(true)}
        className={cn('size-full', screen ? 'object-contain' : 'object-cover', mine && !screen && mirror && '-scale-x-100', !playing && 'opacity-0')}
      />
      {!playing && <div className="absolute inset-0 grid place-items-center text-text-2"><span className="spinner" /></div>}

      {diagnostics && !thumbnail && (
        <dl className="pointer-events-none absolute top-2 left-2 grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 rounded-md bg-(--chip-on-video) px-2.5 py-2 t-micro tnum backdrop-blur-md">
          {diagnostics.map(row => (
            <div key={row.label} className="contents">
              <dt className="text-text-2">{row.label}</dt>
              <dd className="text-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {!thumbnail && <div className="reveal pointer-events-none absolute inset-x-0 bottom-0 h-14" style={{ background: 'var(--scrim)' }} />}

      <div className={cn('absolute flex items-center gap-1.5 rounded-full bg-(--chip-on-video) text-white backdrop-blur-md t-micro', thumbnail ? 'bottom-1.5 left-1.5 h-5 px-2' : 'bottom-3 left-3 h-6 px-2.5')}>
        {screen && <span className="tally-dot" data-light={props.lights || undefined} />}
        <span className="max-w-[18ch] truncate">{label}</span>
        {away && <Moon className="size-3 text-text-2" strokeWidth={1.75} aria-label="Ausente" />}
      </div>

      {!thumbnail && (
        <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
          {mine && screen && props.onStop && (
            <Button variant="video" size="sm" className="reveal h-8 rounded-full px-3 t-small" onClick={props.onStop}>
              <MonitorOff className="size-4" strokeWidth={1.75} />Parar de mostrar
            </Button>
          )}
          {volumeControl && <VolumeButton audio={audio} muted={muted} onAudio={props.onAudio} />}
          <Tip label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'} shortcut={fullscreen ? 'Esc' : 'duplo clique'}>
            <Button variant="video" size="icon-sm" className="reveal" aria-label={fullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia (duplo clique)'} onClick={props.onFullscreen}>
              {fullscreen ? <Minimize strokeWidth={1.75} /> : <Maximize strokeWidth={1.75} />}
            </Button>
          </Tip>
          {canTheater && !fullscreen && !theater && (
            <Tip label="Modo teatro" shortcut="T">
              <Button variant="video" size="icon-sm" className="reveal" aria-label="Modo teatro (T)" onClick={props.onTheater}>
                <RectangleHorizontal strokeWidth={1.75} />
              </Button>
            </Tip>
          )}
        </div>
      )}
    </div>
  )
}

function VolumeButton({ audio, muted, onAudio }: { audio: TileAudio; muted: boolean; onAudio: (next: TileAudio) => void }) {
  const toggle = () => onAudio({ ...audio, muted: !muted })
  const label = muted ? 'Ativar som' : 'Mutar'
  if (muted) {
    // A muted tile has to say so: this button never fades with the other overlays.
    return (
      <Tip label={label}>
        <Button variant="video" size="icon-sm" aria-label={label} onClick={toggle}>
          <VolumeX strokeWidth={1.75} />
        </Button>
      </Tip>
    )
  }
  const percent = Math.round(audio.volume * 100)
  return (
    <Popover>
      <PopoverTrigger openOnHover delay={150} render={<Button variant="video" size="icon-sm" className="reveal" aria-label={label} onClick={toggle} />}>
        <Volume2 strokeWidth={1.75} />
      </PopoverTrigger>
      <PopoverContent side="top" className="w-14 items-center gap-2 px-2 py-3" initialFocus={false}>
        <span className="t-micro tnum text-text-2" aria-hidden="true">{percent}</span>
        <Slider
          orientation="vertical"
          aria-label="Volume"
          min={0}
          max={100}
          value={[percent]}
          onValueChange={value => onAudio({ ...audio, volume: (Array.isArray(value) ? value[0] : value) / 100 })}
          className="h-28"
        />
      </PopoverContent>
    </Popover>
  )
}
