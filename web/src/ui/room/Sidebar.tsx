import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Link2, LogOut, Moon, MoreHorizontal, Pencil } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { useFlip } from '../hooks'
import { Tip } from '../tip'

export interface Person {
  id: string
  name: string | null
  you: boolean
  live: boolean
  camera: boolean
  away: boolean
}

export function CopyLinkButton({ onCopy }: { onCopy: () => Promise<boolean> }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <Tip label="Copiar link da sala">
      <Button variant="icon" size="icon" aria-label="Copiar link da sala" onClick={() => void onCopy().then(ok => setCopied(ok))}>
        <span className="swap-icon relative grid size-[18px] place-items-center">
          <Link2 className={cn('absolute', copied && 'opacity-0')} />
          <Check className={cn('absolute', !copied && 'opacity-0')} />
        </span>
      </Button>
    </Tip>
  )
}

function Row({ person }: { person: Person }) {
  const connecting = person.name === null
  return (
    <li
      data-flip={person.id}
      className="flex h-9 items-center gap-2.5 rounded-sm px-3 hover:bg-surface-2"
    >
      {connecting ? (
        <span className="pulse-outline size-6 flex-none rounded-full border border-border-strong" aria-hidden="true" />
      ) : (
        <Avatar><AvatarFallback>{person.name!.slice(0, 1)}</AvatarFallback></Avatar>
      )}
      <span key={person.name ?? ''} className={cn('min-w-0 truncate animate-in fade-in-0 duration-200', connecting ? 'text-text-3' : person.away ? 'text-text-2' : 'text-text')}>
        {connecting ? 'conectando…' : person.name}
        {person.you && <span className="text-text-2"> (você)</span>}
      </span>
      <span className="ml-auto flex items-center gap-2 text-text-2">
        {person.live && <Tip label="ao vivo"><span className="tally-dot" role="img" aria-label="ao vivo" /></Tip>}
        {person.camera && <Tip label="Câmera ligada"><Camera className="size-3.5" strokeWidth={1.75} role="img" aria-label="Câmera ligada" /></Tip>}
        {person.away && <Tip label="Ausente"><Moon className="size-3.5" strokeWidth={1.75} role="img" aria-label="Ausente" /></Tip>}
      </span>
    </li>
  )
}

export function Sidebar({ people, me, onCopy, onAway, onRename, onLeave }: {
  people: readonly Person[]
  me: Person
  /** Absent in the narrow sheet, where the stage's top row has the copy button. */
  onCopy?: () => Promise<boolean>
  onAway: (away: boolean) => void
  onRename: () => void
  onLeave: () => void
}) {
  const list = useRef<HTMLUListElement>(null)
  useFlip(list)
  const awayLabel = me.away ? 'Estou de volta' : 'Ficar ausente'

  return (
    <nav aria-label="Pessoas na sala" className="flex h-full w-full flex-col bg-page">
      <div className="flex h-14 flex-none items-center justify-between pr-2 pl-5">
        <span className="t-heading">Telão</span>
        {onCopy && <CopyLinkButton onCopy={onCopy} />}
      </div>
      <div className="flex items-baseline gap-2 px-5 pt-3 pb-2 t-small">
        <span className="font-[550] text-text">Na sala</span>
        <span className="tnum text-text-2">{people.length}</span>
      </div>
      <ul ref={list} className="grid gap-0.5 overflow-y-auto px-2" role="list">
        {people.map(person => <Row key={person.id} person={person} />)}
      </ul>
      {people.length === 1 && <p className="px-5 pt-3 t-small text-text-2">Só você por aqui. Copia o link e manda no Discord.</p>}

      <div className="mt-auto flex items-center gap-1 border-t border-hairline p-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<button className="press flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-sm px-3 text-left hover:bg-surface-2 aria-expanded:bg-surface-2" aria-label={`${me.name ?? ''}, opções`} />}>
            <Avatar><AvatarFallback>{(me.name ?? '?').slice(0, 1)}</AvatarFallback></Avatar>
            <span className={cn('truncate', me.away ? 'text-text-2' : 'text-text')}>{me.name}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8}>
            <DropdownMenuItem onClick={onRename}><Pencil />Trocar nome</DropdownMenuItem>
            <DropdownMenuItem onClick={onLeave}><LogOut />Sair da sala</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label={me.away ? awayLabel : 'Avisa a sala que você saiu de perto. As lives continuam tocando.'}>
          <Button variant="icon" size="icon" aria-label={awayLabel} aria-pressed={me.away} onClick={() => onAway(!me.away)}>
            <Moon />
          </Button>
        </Tip>
        <DropdownMenu>
          <Tip label="Mais opções" popover={trigger => <DropdownMenuTrigger render={trigger}><MoreHorizontal /></DropdownMenuTrigger>}>
            <Button variant="icon" size="icon" aria-label="Mais opções" />
          </Tip>
          <DropdownMenuContent side="top" align="end" sideOffset={8}>
            <DropdownMenuItem onClick={onRename}><Pencil />Trocar nome</DropdownMenuItem>
            <DropdownMenuItem onClick={onLeave}><LogOut />Sair da sala</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  )
}
