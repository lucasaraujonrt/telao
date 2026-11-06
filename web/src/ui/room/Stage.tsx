import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { useDefaultLayout } from 'react-resizable-panels'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { prefs } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { Tile, TileKey } from '../../room/room'
import { useFlip } from '../hooks'

export interface RenderOptions { thumbnail?: boolean; lights?: boolean }

/** Long enough for a double click (fullscreen) to cancel the single click (focus). */
const CLICK_MS = 250

export function Stage({ connecting, screens, cameras, self, selfTile, theater, narrow, dockHidden, dock, top, layoutEpoch, renderTile, onShare, onFocus, shareDisabled }: {
  connecting: boolean
  /** Screens from the others. Your own share never takes the stage; it lives in `self`. */
  screens: readonly Tile[]
  cameras: readonly Tile[]
  /** Your own screen preview while you share: a small card in the strip. */
  self: ReactNode
  /** Your screen while its preview is shown, so theater can focus it. */
  selfTile: Tile | null
  theater: TileKey | null
  narrow: boolean
  dockHidden: boolean
  dock: ReactNode
  /** The narrow top row: people button and copy link. */
  top?: ReactNode
  /** Bumped by "Restaurar tamanhos": every panel group mounts again at its default sizes. */
  layoutEpoch: number
  /** Renders any tile, your shown screen preview included, so theater can focus it. */
  renderTile: (tile: Tile, options?: RenderOptions) => ReactNode
  onShare: () => void
  onFocus: (key: TileKey) => void
  shareDisabled: boolean
}) {
  const root = useRef<HTMLElement>(null)
  // Lights on: the first screen after an empty stage gets the one orchestrated entrance.
  const hasScreens = screens.length > 0
  const [seen, setSeen] = useState<{ has: boolean | null; lights: TileKey | null }>({ has: null, lights: null })
  if (seen.has !== hasScreens) setSeen({ has: hasScreens, lights: seen.has === false && hasScreens ? screens[0].key : null })

  const main = hasScreens ? screens : cameras
  const strip = hasScreens ? cameras : []
  const all = [...screens, ...cameras]
  const focused = theater ? [...all, ...(selfTile ? [selfTile] : [])].find(tile => tile.key === theater) : undefined
  const remeasure = useFlip(root, [focused ? `focus:${focused.key}` : 'grid', ...main.map(tile => tile.key), '|', ...strip.map(tile => tile.key), self ? 'self' : ''].join(' '))

  // A single click on a grid tile focuses it; a double click is fullscreen and cancels the focus.
  const clickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(clickTimer.current), [])
  const focusOnClick = (key: TileKey) => ({
    onClick: (event: MouseEvent<HTMLElement>) => {
      clearTimeout(clickTimer.current)
      const target = event.target as HTMLElement
      // Controls on the tile keep their own click; popovers are portals outside the cell.
      if (event.detail !== 1 || !event.currentTarget.contains(target) || target.closest('button, a, input, [role="slider"]')) return
      clickTimer.current = setTimeout(() => onFocus(key), CLICK_MS)
    },
    onDoubleClick: () => clearTimeout(clickTimer.current),
  })

  const tile = (item: Tile, options: RenderOptions & { className?: string } = {}) => (
    <div key={item.key} data-flip={item.key} data-lights={options.lights || undefined} className={options.className}>
      {renderTile(item, options)}
    </div>
  )
  const stripItems = (className: string) => [
    self && <div key="self" data-flip="self" className={className}>{self}</div>,
    ...strip.map(item => tile(item, { className })),
  ]

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
        {(others.length > 0 || (self && focused !== selfTile)) && (
          <div className={cn('dock absolute inset-x-2 bottom-[84px] flex h-24 justify-center gap-2', dockHidden && 'pointer-events-none')} data-hidden={dockHidden || undefined}>
            {others.map(item => (
              <button key={item.key} type="button" className="aspect-video h-full rounded-[12px]" aria-label="Destacar esta tela" onClick={() => onFocus(item.key)}>
                {tile(item, { thumbnail: true, className: 'size-full' })}
              </button>
            ))}
            {self && focused !== selfTile && <div data-flip="self" className="aspect-video h-full">{self}</div>}
          </div>
        )}
      </>
    )
  } else if (main.length === 0) {
    body = self ? (
      // Only you are live: your preview waits in the middle, as small as it is in the strip.
      <div className="grid h-full place-items-center p-6 pb-[84px]">
        <div data-flip="self" className="aspect-video w-[min(320px,100%)]">{self}</div>
      </div>
    ) : (
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
        {main.map(item => tile(item, { className: 'aspect-video w-full flex-none' }))}
        {(self || strip.length > 0) && <div className="flex h-[112px] flex-none gap-2 overflow-x-auto">{stripItems('aspect-video h-full flex-none')}</div>}
      </div>
    )
  } else {
    const grid = (
      <PanelGrid
        count={main.length}
        onSettled={remeasure}
        cell={index => {
          const item = main[index]
          return item && (
            <div key={item.key} className="fit-cell size-full" {...focusOnClick(item.key)}>
              {tile(item, { className: 'fit-tile', lights: item.key === seen.lights })}
            </div>
          )
        }}
      />
    )
    body = (
      <div key={layoutEpoch} className="h-full p-2 pb-[84px]">
        {self || strip.length > 0 ? (
          <SavedGroup id="strip" orientation="vertical" panels={['main', 'strip']} onSettled={remeasure}>
            <ResizablePanel id="main" minSize="40">{grid}</ResizablePanel>
            <ResizableHandle aria-label="Tamanho das câmeras" />
            <ResizablePanel id="strip" defaultSize={112} minSize={88} maxSize="50">
              <div className="flex h-full gap-2 overflow-x-auto">{stripItems('aspect-video h-full flex-none')}</div>
            </ResizablePanel>
          </SavedGroup>
        ) : grid}
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

/** A panel group that keeps its sizes in localStorage under its id, saved once a drag ends. */
function SavedGroup({ id, orientation, panels, onSettled, children }: {
  id: string
  orientation: 'horizontal' | 'vertical'
  panels: string[]
  onSettled: () => void
  children: ReactNode
}) {
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id, panelIds: panels, storage: prefs.layouts, onlySaveAfterUserInteractions: true })
  return (
    <ResizablePanelGroup
      id={id}
      orientation={orientation}
      defaultLayout={defaultLayout}
      onLayoutChanged={(layout, meta) => { onLayoutChanged(layout, meta); onSettled() }}
    >
      {children}
    </ResizablePanelGroup>
  )
}

/**
 * The balanced grid as resizable panels: one tile alone, two side by side, three or four in two rows
 * of two, more in rows of three. The last row keeps its empty cells, black, so the tiles keep their
 * size when one more arrives. Sizes are saved per shape (rows by columns), not per person.
 */
function PanelGrid({ count, cell, onSettled }: { count: number; cell: (index: number) => ReactNode; onSettled: () => void }) {
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3
  const rows = Math.ceil(count / cols)
  if (count <= 1) return <div className="size-full">{cell(0)}</div>
  const shape = `grid-${rows}x${cols}`
  const columns = Array.from({ length: cols }, (_, col) => `c${col}`)
  const row = (r: number) => (
    <SavedGroup id={rows === 1 ? shape : `${shape}-r${r}`} orientation="horizontal" panels={columns} onSettled={onSettled}>
      {columns.map((id, col) => [
        col > 0 && <ResizableHandle key={`h${id}`} aria-label="Tamanho das telas" />,
        <ResizablePanel key={id} id={id} minSize={120}>{cell(r * cols + col)}</ResizablePanel>,
      ])}
    </SavedGroup>
  )
  if (rows === 1) return row(0)
  const rowIds = Array.from({ length: rows }, (_, r) => `r${r}`)
  return (
    <SavedGroup id={shape} orientation="vertical" panels={rowIds} onSettled={onSettled}>
      {rowIds.map((id, r) => [
        r > 0 && <ResizableHandle key={`h${id}`} aria-label="Tamanho das telas" />,
        <ResizablePanel key={id} id={id} minSize={80}>{row(r)}</ResizablePanel>,
      ])}
    </SavedGroup>
  )
}
