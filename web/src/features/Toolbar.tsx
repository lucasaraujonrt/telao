import { AudioLines } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tip } from '../ui/tip'
import type { Reaction } from './reactions/reactions'
import { EMOJI, ITEM_KEYS, ITEM_NAMES, type Item } from './throwables/throwables'
import './zoeira.css'

export interface ToolbarProps {
  reactions: readonly Reaction[]
  onReact: (reaction: Reaction) => void
  items: readonly Item[]
  armed: Item | null
  onArm: (item: Item | null) => void
  panel: boolean
  onPanel: (open: boolean) => void
  disabled: boolean
}

const Divider = () => <span aria-hidden="true" className="mx-1 h-6 w-px bg-border-strong" />
const EMOJI_BUTTON = 'text-[20px] leading-none'

/** The dock's Phase 3 group: reactions, throwables, and the memes button that opens the side panel. */
export function Toolbar(props: ToolbarProps) {
  const { disabled } = props
  return (
    <div role="group" aria-label="Zoeira" className="flex items-center gap-1">
      {props.reactions.map((reaction, index) => (
        <Tip key={reaction} label="Reagir na tela" shortcut={String(index + 1)}>
          <Button variant="icon" size="icon" className={EMOJI_BUTTON} aria-label={`Reagir ${reaction} (${index + 1})`} disabled={disabled} onClick={() => props.onReact(reaction)}>
            {reaction}
          </Button>
        </Tip>
      ))}
      <Divider />
      {props.items.map(item => (
        <Tip key={item} label={`${ITEM_NAMES[item]}: arma e clica numa tela`} shortcut={ITEM_KEYS[item]}>
          <Button
            variant="icon"
            size="icon"
            className={cn(EMOJI_BUTTON, 'aria-pressed:bg-accent-soft')}
            aria-label={`${ITEM_NAMES[item]} (${ITEM_KEYS[item]})`}
            aria-pressed={props.armed === item}
            disabled={disabled}
            onClick={() => props.onArm(item)}
          >
            {EMOJI[item]}
          </Button>
        </Tip>
      ))}
      <Divider />
      <Tip label={props.panel ? 'Fechar memes' : 'Memes'} shortcut="B">
        <Button variant="icon" size="icon" aria-label={props.panel ? 'Fechar memes (B)' : 'Memes (B)'} aria-pressed={props.panel} disabled={disabled} onClick={() => props.onPanel(!props.panel)}>
          <AudioLines />
        </Button>
      </Tip>
    </div>
  )
}

/** On narrow screens the toolbar is a second dock row, above the dock, hiding with it. */
export function ToolbarRow({ hidden, children }: { hidden: boolean; children: React.ReactNode }) {
  return (
    <div
      className="dock mb-2 flex h-[52px] w-max max-w-full items-center rounded-full border border-hairline bg-surface/88 p-1.5 shadow-2 backdrop-blur-[20px]"
      data-hidden={hidden || undefined}
    >
      {children}
    </div>
  )
}
