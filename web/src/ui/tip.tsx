import type { ReactElement, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/** A tooltip around one trigger element. The shortcut follows the label in the quiet gray. */
export function Tip({ label, shortcut, side = 'top', children, popover }: {
  label: ReactNode
  shortcut?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: ReactElement
  /** For a popover's trigger: the popover trigger stays outermost so its click handling wins. */
  popover?: (trigger: ReactElement) => ReactElement
}) {
  const trigger = <TooltipTrigger render={children} />
  return (
    <Tooltip>
      {popover ? popover(trigger) : trigger}
      <TooltipContent side={side}>
        <span>{label}</span>
        {shortcut && <span className="text-text-3">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}
