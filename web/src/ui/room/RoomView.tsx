import { useCallback, useEffect, useRef, useState } from 'react'
import { Users, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Toaster } from '@/components/ui/sonner'
import { diagnosticRows, type DiagnosticRow } from '@/lib/format'
import { prefs } from '@/lib/storage'
import { cn } from '@/lib/utils'
import type { VideoStats } from '../../media/streaming'
import type { Room, RoomSnapshot, Tile as TileData, TileKey } from '../../room/room'
import { useHotkeys } from '../../features/hooks'
import { MemesPanel } from '../../features/memes/MemesPanel'
import { useMemes } from '../../features/memes/useMemes'
import { useReactions } from '../../features/reactions/useReactions'
import { useThrowables } from '../../features/throwables/useThrowables'
import { Toolbar, ToolbarRow } from '../../features/Toolbar'
import { useSounds } from '../../features/useSounds'
import { AUTOPLAY_BLOCKED, NOTICES } from '../copy'
import { useColorScheme, useMediaQuery, useNarrow } from '../hooks'
import { Dock } from './Dock'
import { RenameDialog } from './RenameDialog'
import { SelfPreview } from './SelfPreview'
import { CopyLinkButton, Sidebar, type Person } from './Sidebar'
import { Stage, type RenderOptions } from './Stage'
import { Tile, type TileAudio } from './Tile'

const DEFAULT_AUDIO: TileAudio = { muted: true, volume: 1 }
const MEASURING: DiagnosticRow[] = (['Codec', 'Resolução', 'Quadros', 'Taxa'] as const).map(label => ({ label, value: 'medindo…' }))
const IDLE_MS = 3000
const NO_STATS: ReadonlyMap<TileKey, VideoStats[]> = new Map()

const editable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))

function useStats(room: Room | null, on: boolean) {
  const [stats, setStats] = useState<ReadonlyMap<TileKey, VideoStats[]>>(NO_STATS)
  useEffect(() => {
    if (!room || !on) return
    let cancelled = false
    const sample = () => void room.sampleStats().then(next => { if (!cancelled) setStats(next) })
    sample()
    const timer = setInterval(sample, 2000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [room, on])
  return on ? stats : NO_STATS
}

export function RoomView({ room, snapshot }: { room: Room | null; snapshot: RoomSnapshot }) {
  useColorScheme('dark')
  const narrow = useNarrow()
  // The dock fits the toolbar group on a wide window; otherwise the group gets its own row.
  const wide = useMediaQuery('(min-width: 1200px)'), wider = useMediaQuery('(min-width: 1600px)')
  const [panel, setPanel] = useState(false)
  const [theater, setTheater] = useState<TileKey | null>(null)
  const [fullscreen, setFullscreen] = useState<TileKey | null>(null)
  const [deaf, setDeaf] = useState(false)
  const [small, setSmall] = useState<ReadonlySet<TileKey>>(new Set())
  const [audio, setAudio] = useState<ReadonlyMap<TileKey, TileAudio>>(new Map())
  const [diagnostics, setDiagnostics] = useState(prefs.diagnostics.get)
  const [profile, setProfile] = useState(prefs.profile.get)
  const [mirror, setMirror] = useState(prefs.mirror.get)
  const [selfShown, setSelfShown] = useState(prefs.selfView.get)
  const [layoutEpoch, setLayoutEpoch] = useState(0)
  const [renaming, setRenaming] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [idle, setIdle] = useState(false)
  const [dockBusy, setDockBusy] = useState(false)
  const [liveSince, setLiveSince] = useState<number | null>(() => snapshot.screen.status === 'live' ? Date.now() : null)
  const hovered = useRef<TileKey | null>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const warnedAutoplay = useRef(false)
  const stats = useStats(room, diagnostics)

  const { members, tiles, screen, camera } = snapshot
  const connecting = snapshot.status.kind === 'connecting'
  const live = screen.status === 'live'
  const order = new Map(members.map((member, index) => [member.id, index]))
  const rank = (tile: TileData) => tile.owner === 'me' ? -1 : order.get(tile.owner) ?? members.length
  const all = [...tiles.values()].sort((a, b) => rank(a) - rank(b))
  // Your own share stays off the stage: it is the small preview, and on the stage only when shown.
  const selfTile = all.find(tile => tile.owner === 'me' && tile.kind === 'screen') ?? null
  const screens = all.filter(tile => tile.kind === 'screen' && tile !== selfTile)
  const cameras = all.filter(tile => tile.kind === 'camera')
  const focusable = [...screens, ...cameras, ...(selfTile && selfShown ? [selfTile] : [])]
  const canFocus = (key: TileKey | null) => !!key && focusable.some(tile => tile.key === key)
  const activeTheater = !narrow && canFocus(theater) ? theater : null
  const atCap = screens.length >= 4
  const dockHidden = idle && !dockBusy && all.length > 0

  const me: Person = { id: 'me', name: snapshot.name, you: true, live, camera: camera.status === 'on', away: snapshot.away }
  const people: Person[] = [me, ...members.map(member => ({
    id: member.id, name: member.name, you: false, away: member.away,
    live: tiles.has(member.id), camera: tiles.has(member.id + ':camera'),
  }))]
  const memberOf = (id: string) => members.find(member => member.id === id)
  const nameOf = (id: string) => memberOf(id)?.name ?? 'Alguém'

  // Phase 3: memes, throwables and reactions. Away drops all three for you only.
  const away = snapshot.away
  const hotkeys = !!room && !connecting && !renaming
  const { sounds, state: soundState } = useSounds(deaf, away)
  const memes = useMemes({ room, sounds, away, nameOf, enabled: hotkeys })
  const throwables = useThrowables({ room, sounds, away, nameOf, hasTiles: focusable.length > 0, enabled: hotkeys })
  // A reaction goes to the tile under the pointer, else the focused one, else the first screen.
  const pickTarget = () => {
    if (hovered.current && canFocus(hovered.current)) return hovered.current
    return activeTheater ?? focusable.find(tile => tile.owner !== 'me')?.key ?? focusable[0]?.key ?? null
  }
  const reactions = useReactions({ room, away, pickTarget, enabled: hotkeys })
  useHotkeys(key => { if (key !== 'b') return; setPanel(open => !open); return true }, { enabled: hotkeys })
  const toolbarInDock = !narrow && (panel ? wider : wide)

  useEffect(() => { document.title = `${live ? '● ' : ''}Telão (${people.length})` }, [live, people.length])
  // The tally timer starts when the share goes live and survives any remount of the dock.
  useEffect(() => room?.subscribe(() => {
    const isLive = room.getSnapshot().screen.status === 'live'
    setLiveSince(current => isLive ? current ?? Date.now() : null)
  }), [room])
  useEffect(() => room?.onNotice(notice => { toast(NOTICES[notice]) }), [room])

  // The core sends each sharer a preference for us: hidden when the page is, thumbnail for anyone
  // but the fullscreen or theater tile, and for any tile drawn small.
  useEffect(() => {
    if (!room) return
    const update = () => room.setViewing({
      hidden: document.visibilityState === 'hidden' && !document.pictureInPictureElement,
      focus: fullscreen ?? activeTheater,
      thumbnails: small,
    })
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [room, fullscreen, activeTheater, small])

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement?.getAttribute('data-tile-key') ?? null)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  const toggleFullscreen = useCallback((key: TileKey) => {
    if (document.fullscreenElement) { void document.exitFullscreen().catch(() => {}); return }
    const node = document.querySelector<HTMLElement>(`[data-tile-key="${CSS.escape(key)}"]`)
    void node?.requestFullscreen().catch(() => {})
  }, [])

  const firstTile = focusable[0]?.key ?? null
  const focusKeys = focusable.map(tile => tile.key).join(' ')
  useEffect(() => {
    const canFocusNow = (key: TileKey | null) => !!key && focusKeys.split(' ').includes(key)
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.repeat || editable(event.target) || renaming) return
      if (event.key === 't' || event.key === 'T') {
        if (narrow) return
        setTheater(current => canFocusNow(current) ? null : canFocusNow(hovered.current) ? hovered.current : firstTile)
      } else if (event.key === 'Escape' && !document.fullscreenElement) {
        setTheater(null)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [narrow, renaming, focusKeys, firstTile])

  const wake = () => {
    setIdle(false)
    clearTimeout(idleTimer.current)
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS)
  }
  useEffect(() => {
    idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS)
    return () => clearTimeout(idleTimer.current)
  }, [])

  const audioOf = (key: TileKey) => audio.get(key) ?? DEFAULT_AUDIO
  const setTileAudio = (key: TileKey, next: TileAudio) => {
    if (deaf && !next.muted) setDeaf(false)
    setAudio(current => new Map(current).set(key, next))
  }
  const onBlocked = (key: TileKey) => {
    setAudio(current => new Map(current).set(key, { ...(current.get(key) ?? DEFAULT_AUDIO), muted: true }))
    if (!warnedAutoplay.current) { warnedAutoplay.current = true; toast(AUTOPLAY_BLOCKED) }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/#${snapshot.code}`)
      toast('Link copiado. Cola no Discord.')
      return true
    } catch { return false }
  }
  const share = () => room?.shareScreen(profile)

  const renderTile = (tile: TileData, options: RenderOptions = {}) => {
    const mine = tile.owner === 'me'
    const owner = mine ? null : memberOf(tile.owner)
    const label = mine ? (tile.kind === 'screen' ? 'Sua tela' : 'Você') : owner?.name ?? 'conectando…'
    const tileStats = stats.get(tile.key)
    const rows = diagnostics && tile.kind === 'screen' ? (tileStats && diagnosticRows(tileStats)) || MEASURING : null
    return (
      <Tile
        tile={tile}
        label={label}
        away={mine ? snapshot.away : !!owner?.away}
        audio={audioOf(tile.key)}
        deaf={deaf}
        mirror={mirror}
        diagnostics={rows}
        thumbnail={options.thumbnail}
        lights={options.lights}
        fullscreen={fullscreen === tile.key}
        theater={activeTheater === tile.key}
        canTheater={!narrow}
        onAudio={next => setTileAudio(tile.key, next)}
        onBlocked={() => onBlocked(tile.key)}
        onFullscreen={() => toggleFullscreen(tile.key)}
        onTheater={() => setTheater(tile.key)}
        onStop={mine && tile.kind === 'screen' ? () => room?.stopScreen() : undefined}
        onSmall={isSmall => setSmall(current => {
          if (current.has(tile.key) === isSmall) return current
          const next = new Set(current)
          if (isSmall) next.add(tile.key); else next.delete(tile.key)
          return next
        })}
      />
    )
  }

  const showSelf = (shown: boolean) => { setSelfShown(shown); prefs.selfView.set(shown) }
  const selfPreview = selfTile && (
    <SelfPreview
      shown={selfShown}
      tile={selfShown && renderTile(selfTile, { thumbnail: true })}
      onShow={() => showSelf(true)}
      onHide={() => showSelf(false)}
      onStop={() => room?.stopScreen()}
      onFocus={() => setTheater(selfTile.key)}
    />
  )

  const sidebar = (inSheet: boolean) => (
    <Sidebar
      people={people}
      me={me}
      onCopy={inSheet ? undefined : copyLink}
      action={inSheet ? (
        <SheetClose render={<Button variant="icon" size="icon" aria-label="Fechar" />}><X /></SheetClose>
      ) : undefined}
      onAway={away => { room?.setAway(away); prefs.away.set(away) }}
      onRename={() => { setSheet(false); setRenaming(true) }}
      onLeave={() => room?.leave()}
    />
  )

  const toolbar = away ? undefined : (
    <Toolbar
      reactions={reactions.reactions}
      onReact={reactions.react}
      items={throwables.items}
      armed={throwables.armed}
      onArm={throwables.arm}
      panel={panel}
      onPanel={setPanel}
      disabled={connecting || !room}
    />
  )
  const dock = (
    <Dock
      disabled={connecting || !room}
      hidden={dockHidden}
      screen={screen}
      camera={camera}
      liveSince={liveSince}
      atCap={atCap}
      profile={profile}
      mirror={mirror}
      deaf={deaf}
      diagnostics={diagnostics}
      layout={activeTheater ? 'focus' : 'grid'}
      canFocus={!narrow && firstTile !== null}
      onProfile={next => { setProfile(next); prefs.profile.set(next) }}
      onShare={share}
      onSwitch={() => { room?.stopScreen(); share() }}
      onStop={() => room?.stopScreen()}
      onCamera={on => { if (on) void room?.startCamera(); else room?.stopCamera() }}
      onEffect={effect => void room?.setCameraEffect(effect)}
      onMirror={on => { setMirror(on); prefs.mirror.set(on) }}
      onDeaf={setDeaf}
      onDiagnostics={on => { setDiagnostics(on); prefs.diagnostics.set(on) }}
      onLayout={next => setTheater(next === 'focus' ? firstTile : null)}
      onResetLayout={() => { prefs.layouts.clear(); setLayoutEpoch(epoch => epoch + 1) }}
      onBusy={setDockBusy}
      toolbar={toolbarInDock ? toolbar : undefined}
    />
  )
  const memesPanel = (onClose: () => void) => (
    <MemesPanel memes={memes} sounds={sounds} soundState={soundState} away={away} onClose={onClose} />
  )

  return (
    <div
      className="flex h-svh overflow-hidden bg-page p-2 text-text"
      onPointerMove={wake}
      onFocusCapture={wake}
      onPointerOver={event => { hovered.current = (event.target as HTMLElement).closest('[data-tile-key]')?.getAttribute('data-tile-key') ?? null }}
      data-armed={throwables.armed ?? undefined}
      {...throwables.handlers}
    >
      {!narrow && (
        // The 8 px gap to the stage lives inside the aside, so it collapses with it in theater.
        <aside className={cn('flex-none overflow-hidden transition-[width] duration-240 ease-(--ease-in-out)', activeTheater ? 'w-0' : 'w-[256px]')} inert={activeTheater !== null}>
          <div className="h-full w-[256px] pr-2">{sidebar(false)}</div>
        </aside>
      )}
      <Stage
        connecting={connecting}
        screens={screens}
        cameras={cameras}
        self={selfPreview}
        selfTile={selfShown ? selfTile : null}
        theater={activeTheater}
        layoutEpoch={layoutEpoch}
        narrow={narrow}
        dockHidden={dockHidden}
        dock={toolbar && !toolbarInDock ? <div className="flex flex-col items-center"><ToolbarRow hidden={dockHidden}>{toolbar}</ToolbarRow>{dock}</div> : dock}
        renderTile={renderTile}
        onShare={share}
        onFocus={setTheater}
        shareDisabled={connecting || atCap}
        top={narrow ? (
          <div className="flex h-14 flex-none items-center justify-between px-2">
            <Button variant="icon" size="sm" className="gap-2 rounded-full" aria-label="Pessoas na sala" onClick={() => setSheet(true)}>
              <Users /><span className="tnum">{people.length}</span>
            </Button>
            <CopyLinkButton onCopy={copyLink} />
          </div>
        ) : undefined}
      />
      {!narrow && (
        // The side panel: 320 px plus the 8 px gap to the stage, which collapses with it.
        <aside className={cn('flex-none overflow-hidden transition-[width] duration-240 ease-(--ease-in-out)', panel ? 'w-[328px]' : 'w-0')} inert={!panel}>
          <div className="h-full w-[328px] pl-2">{memesPanel(() => setPanel(false))}</div>
        </aside>
      )}
      {narrow && (
        <Sheet open={panel} onOpenChange={setPanel}>
          <SheetContent side="right" className="w-[320px] gap-0 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Memes</SheetTitle>
            {memesPanel(() => setPanel(false))}
          </SheetContent>
        </Sheet>
      )}
      {narrow && (
        <Sheet open={sheet} onOpenChange={setSheet}>
          <SheetContent side="left" className="w-[280px] gap-0 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Pessoas na sala</SheetTitle>
            {sidebar(true)}
          </SheetContent>
        </Sheet>
      )}
      <RenameDialog
        open={renaming}
        name={snapshot.name}
        onOpenChange={setRenaming}
        onSave={name => {
          room?.setName(name)
          prefs.nick.set(name)
          setRenaming(false)
          toast(`Agora você é ${name}.`)
        }}
      />
      <Toaster position="top-center" theme="dark" />
    </div>
  )
}
