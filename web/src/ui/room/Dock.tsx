import { useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Camera, CameraOff, Check, ChevronDown, Minimize2, Monitor, Settings, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { formatElapsed } from '@/lib/format'
import type { CameraEffect } from '../../media/camera-source'
import type { ScreenProfileName } from '../../media/capture'
import type { CameraState, ScreenState } from '../../room/room'
import { EFFECTS, PROFILES } from '../copy'
import { Segmented } from '../Segmented'
import { Tip } from '../tip'

type Menu = 'share' | 'camera' | 'settings' | null

export interface DockProps {
  disabled: boolean
  hidden: boolean
  screen: ScreenState
  camera: CameraState
  liveSince: number | null
  atCap: boolean
  profile: ScreenProfileName
  mirror: boolean
  deaf: boolean
  diagnostics: boolean
  theater: boolean
  onProfile: (profile: ScreenProfileName) => void
  onShare: () => void
  onSwitch: () => void
  onStop: () => void
  onCamera: (on: boolean) => void
  onEffect: (effect: CameraEffect) => void
  onMirror: (on: boolean) => void
  onDeaf: (on: boolean) => void
  onDiagnostics: (on: boolean) => void
  onLeaveTheater: () => void
  onBusy: (busy: boolean) => void
  /** Phase 3: reactions, throwables and the memes button go here, after a divider. */
  toolbar?: ReactNode
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-6 w-px bg-border-strong" />

/** Two halves of one pill: the action and the chevron that opens its options. */
function Split({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative flex h-10 items-center rounded-full', className)}>{children}</div>
}
const Chevron = () => (
  <>
    <span aria-hidden="true" className="absolute top-[10px] bottom-[10px] w-px bg-border-strong" style={{ left: 'calc(100% - 24px)' }} />
    <ChevronDown className="size-3.5!" strokeWidth={1.75} />
  </>
)

export function Dock(props: DockProps) {
  const { disabled, hidden, theater } = props
  const [menu, setMenu] = useState<Menu>(null)
  const root = useRef<HTMLDivElement>(null)
  const [focusInside, setFocusInside] = useState(false)
  const open = (which: Exclude<Menu, null>) => ({
    open: menu === which,
    onOpenChange: (next: boolean) => setMenu(next ? which : current => current === which ? null : current),
  })
  const onBusy = useEffectEvent((value: boolean) => props.onBusy(value))
  const busy = menu !== null || focusInside
  useEffect(() => { onBusy(busy) }, [busy])

  return (
    <div
      ref={root}
      role="toolbar"
      aria-label="Controles da sala"
      className="dock flex h-[52px] items-center gap-1 rounded-full border border-hairline bg-surface/88 p-1.5 shadow-2 backdrop-blur-[20px]"
      data-hidden={hidden && !busy ? '' : undefined}
      onFocus={() => setFocusInside(true)}
      onBlur={event => { if (!root.current?.contains(event.relatedTarget as Node | null)) setFocusInside(false) }}
    >
      <ShareControl {...props} popover={open('share')} />
      <CameraControl {...props} popover={open('camera')} />
      <Tip label={props.deaf ? 'Desmutar tudo' : 'Mutar tudo'}>
        <Button variant="icon" size="icon" aria-label={props.deaf ? 'Desmutar tudo' : 'Mutar tudo'} aria-pressed={props.deaf} disabled={disabled} onClick={() => props.onDeaf(!props.deaf)}>
          {props.deaf ? <VolumeX /> : <Volume2 />}
        </Button>
      </Tip>
      <Popover {...open('settings')}>
        <Tip label="Ajustes" popover={trigger => <PopoverTrigger render={trigger}><Settings /></PopoverTrigger>}>
          <Button variant="icon" size="icon" aria-label="Ajustes" disabled={disabled} />
        </Tip>
        <PopoverContent side="top">
          <PopoverTitle>Ajustes</PopoverTitle>
          <label className="flex items-center justify-between gap-4 t-body">
            Mostrar diagnóstico nas telas
            <Switch checked={props.diagnostics} onCheckedChange={props.onDiagnostics} />
          </label>
        </PopoverContent>
      </Popover>
      {theater && (
        <Tip label="Sair do modo teatro" shortcut="Esc">
          <Button variant="icon" size="icon" aria-label="Sair do modo teatro (Esc)" onClick={props.onLeaveTheater}>
            <Minimize2 />
          </Button>
        </Tip>
      )}
      {props.toolbar && <><Divider />{props.toolbar}</>}
    </div>
  )
}

type PopoverState = { open: boolean; onOpenChange: (open: boolean) => void }

function ShareControl(props: DockProps & { popover: PopoverState }) {
  const { screen, disabled, atCap, popover } = props
  const live = screen.status === 'live'
  const starting = screen.status === 'starting'
  const blocked = atCap && screen.status === 'off'
  const content = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)

  // The share button morphs into the tally: the pill's width follows its content, never stretching text.
  useLayoutEffect(() => {
    const node = content.current
    if (!node) return
    const measure = () => setWidth(node.offsetWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const chevron = (
    <PopoverTrigger
      render={<Button variant="icon" className="h-10 w-6 rounded-l-none rounded-r-full px-0" aria-label="Qualidade" disabled={disabled || blocked} />}
    >
      <Chevron />
    </PopoverTrigger>
  )

  let main: ReactNode
  if (live) {
    main = (
      <Tip
        label={screen.hasAudio ? 'Com o som da aba' : 'Sem som: só o som de uma aba vai junto'}
        popover={trigger => (
          <PopoverTrigger render={trigger}>
            <span className="tally-dot" data-light="" />
            <span>Ao vivo</span>
            <Elapsed since={props.liveSince} />
            {!screen.hasAudio && <VolumeX className="size-4! text-text-2" aria-label="sem som" />}
          </PopoverTrigger>
        )}
      >
        <Button variant="ghost" className="h-10 gap-2 rounded-l-full rounded-r-none pr-2 pl-3.5" />
      </Tip>
    )
  } else if (starting) {
    main = (
      <Button variant="ghost" className="h-10 gap-2 rounded-l-full rounded-r-none pr-2 pl-3.5 text-text-2" disabled>
        <span className="tally-dot" data-pending="" />Escolhendo tela…
      </Button>
    )
  } else {
    main = (
      <Button variant="icon" size="icon" className="rounded-l-full rounded-r-none" aria-label="Mostrar minha tela" disabled={disabled || blocked} focusableWhenDisabled={blocked} onClick={props.onShare}>
        <Monitor />
      </Button>
    )
  }

  const tip = live || starting ? null : blocked ? 'Já tem quatro mostrando a tela. Espera alguém parar.' : 'Mostrar minha tela'

  return (
    <Popover {...popover}>
      <Split className="overflow-hidden transition-[width] duration-240 ease-(--ease-out)">
        <div style={{ width: width ?? undefined }} className="h-10 overflow-hidden transition-[width] duration-240 ease-(--ease-out)">
          <div ref={content} className="inline-flex h-10 w-max">
            {tip ? <Tip label={tip}>{main as React.ReactElement}</Tip> : main}
          </div>
        </div>
        {chevron}
      </Split>
      <PopoverContent side="top">
        <PopoverTitle>Qualidade</PopoverTitle>
        <ToggleGroup
          orientation="vertical"
          spacing={0}
          aria-label="Qualidade"
          value={[props.profile]}
          onValueChange={next => { const picked = next[0] as ScreenProfileName | undefined; if (picked) props.onProfile(picked) }}
          className="w-full gap-0.5"
        >
          {PROFILES.map(option => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="h-auto justify-between rounded-md! px-3 py-2 text-left hover:bg-surface-2 aria-pressed:bg-accent-soft data-[pressed]:bg-accent-soft"
            >
              <span className="grid">
                <span className="t-body font-[550] text-text">{option.label}</span>
                <span className="t-small text-text-2">{option.hint}</span>
              </span>
              {props.profile === option.value && <Check className="size-4 text-accent-blue" strokeWidth={2} />}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {live ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => { popover.onOpenChange(false); props.onStop() }}>Parar de mostrar</Button>
            <Button onClick={() => { popover.onOpenChange(false); props.onSwitch() }}>Trocar tela</Button>
          </div>
        ) : (
          <Button disabled={blocked || starting} onClick={() => { popover.onOpenChange(false); props.onShare() }}>Mostrar minha tela</Button>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Elapsed({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return <span className="tnum text-text-2">{formatElapsed(since === null ? 0 : now - since)}</span>
}

function CameraControl(props: DockProps & { popover: PopoverState }) {
  const { camera, disabled, popover } = props
  const on = camera.status === 'on'
  const starting = camera.status === 'starting'
  const label = on ? 'Desligar câmera' : 'Ligar câmera'
  return (
    <Popover {...popover}>
      <Split>
        <Tip label={label}>
          <Button variant="icon" size="icon" className="rounded-l-full rounded-r-none" aria-label={label} aria-pressed={on} disabled={disabled || starting} onClick={() => props.onCamera(!on)}>
            {starting ? <span className="spinner" /> : on ? <Camera /> : <CameraOff />}
          </Button>
        </Tip>
        <PopoverTrigger render={<Button variant="icon" className="h-10 w-6 rounded-l-none rounded-r-full px-0" aria-label="Câmera" disabled={disabled} />}>
          <Chevron />
        </PopoverTrigger>
      </Split>
      <PopoverContent side="top">
        <PopoverTitle>Câmera</PopoverTitle>
        <Button variant={on ? 'secondary' : 'primary'} disabled={starting} onClick={() => props.onCamera(!on)}>
          {starting && <span className="spinner" />}{label}
        </Button>
        <div className="grid gap-2">
          <span className="t-small text-text-2">Efeito</span>
          <Segmented label="Efeito" value={camera.effect} options={EFFECTS} onChange={props.onEffect} />
        </div>
        <label className="flex items-center justify-between gap-4 t-body">
          Espelhar
          <Switch checked={props.mirror} onCheckedChange={props.onMirror} />
        </label>
      </PopoverContent>
    </Popover>
  )
}
