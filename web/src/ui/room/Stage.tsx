import { useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Tile, TileKey } from '../../room/room'
import { useFlip } from '../hooks'

export interface RenderOptions { thumbnail?: boolean; lights?: boolean }

export function Stage({ connecting, screens, cameras, theater, narrow, dockHidden, dock, top, renderTile, onShare, onFocus, shareDisabled }: {
  connecting: boolean
  screens: readonly Tile[]
  cameras: readonly Tile[]
  theater: TileKey | null
  narrow: boolean
  dockHidden: boolean
  dock: ReactNode
  /** The narrow top row: people button and copy link. */
  top?: ReactNode
  renderTile: (tile: Tile, options?: RenderOptions) => ReactNode
  onShare: () => void
  onFocus: (key: TileKey) => void
  shareDisabled: boolean
}) {
  const root = useRef<HTMLElement>(null)
  useFlip(root)
  // Lights on: the first screen after an empty stage gets the one orchestrated entrance.
  const hasScreens = screens.length > 0
  const [seen, setSeen] = useState<{ has: boolean | null; lights: TileKey | null }>({ has: null, lights: null })
  if (seen.has !== hasScreens) setSeen({ has: hasScreens, lights: seen.has === false && hasScreens ? screens[0].key : null })

  const all = [...screens, ...cameras]
  const focused = theater ? all.find(tile => tile.key === theater) : undefined
  const tile = (item: Tile, options: RenderOptions & { className?: string } = {}) => (
    <div key={item.key} data-flip={item.key} data-lights={options.lights || undefined} className={options.className}>
      {renderTile(item, options)}
    </div>
  )

  let body: ReactNode
  if (connecting) {
    body = (
      <div className="grid h-full place-items-center">
        <p className="flex items-center gap-3 t-body text-text-2" role="status"><span className="spinner" />Entrando na sala…</p>
      </div>
    )
  } else if (focused) {
    const others = all.filter(item => item.key !== focused.key)
    body = (
      <>
        {/* The focused tile takes the whole stage. The strip of other tiles floats over its foot, above
            the dock, and fades out with it. */}
        <div className="fit-cell absolute inset-2">{tile(focused, { className: 'fit-tile' })}</div>
        {others.length > 0 && (
          <div className={cn('dock absolute inset-x-2 bottom-[84px] flex h-24 justify-center gap-2', dockHidden && 'pointer-events-none')} data-hidden={dockHidden || undefined}>
            {others.map(item => (
              <button key={item.key} type="button" className="aspect-video h-full rounded-[12px]" aria-label="Focar esta tela" onClick={() => onFocus(item.key)}>
                {tile(item, { thumbnail: true, className: 'size-full' })}
              </button>
            ))}
          </div>
        )}
      </>
    )
  } else if (all.length === 0) {
    body = (
      <div className="grid h-full place-items-center p-6">
        <div className="grid max-w-[320px] justify-items-center gap-2 text-center">
          <h2 className="t-title">Telão apagado</h2>
          <p className="t-body text-text-2">Ninguém está mostrando a tela.</p>
          <Button className="mt-4" disabled={shareDisabled} onClick={onShare}>Mostrar minha tela</Button>
        </div>
      </div>
    )
  } else if (narrow) {
    body = (
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-2 pb-[84px]">
        {(screens.length ? screens : cameras).map(item => tile(item, { className: 'aspect-video w-full flex-none' }))}
        {screens.length > 0 && cameras.length > 0 && <CameraStrip>{cameras.map(item => tile(item, { className: 'aspect-video h-full flex-none' }))}</CameraStrip>}
      </div>
    )
  } else {
    const grid = screens.length ? screens : cameras
    body = (
      <div className="flex h-full flex-col gap-2 p-2 pb-[84px]">
        <Grid count={grid.length}>{grid.map(item => (
          <div key={item.key} className="fit-cell">{tile(item, { className: 'fit-tile', lights: item.key === seen.lights })}</div>
        ))}</Grid>
        {screens.length > 0 && cameras.length > 0 && <CameraStrip>{cameras.map(item => tile(item, { className: 'aspect-video h-full flex-none' }))}</CameraStrip>}
      </div>
    )
  }

  return (
    <section ref={root} aria-label="Telão" className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-stage text-text">
      {top}
      <div className="relative min-h-0 flex-1">{body}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-2">
        <div className="pointer-events-auto max-w-full">{dock}</div>
      </div>
    </section>
  )
}

function Grid({ count, children }: { count: number; children: ReactNode }) {
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3
  const rows = Math.ceil(count / cols)
  return (
    <div className="grid min-h-0 flex-1 gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
      {children}
    </div>
  )
}

function CameraStrip({ children }: { children: ReactNode }) {
  return <div className="flex h-[112px] flex-none gap-2 overflow-x-auto">{children}</div>
}
