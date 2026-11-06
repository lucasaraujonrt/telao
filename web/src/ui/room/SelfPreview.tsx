import type { ReactNode } from 'react'
import { Eye, EyeOff, MonitorOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tip } from '../tip'

/**
 * Your own share, kept small like Discord's preview. Hidden (the default) mounts no <video>, so the
 * page decodes and composites nothing for it; shown, it is a thumbnail tile that theater can focus.
 */
export function SelfPreview({ shown, tile, onShow, onHide, onStop, onFocus }: {
  shown: boolean
  /** The thumbnail tile of your screen, rendered only while shown. */
  tile: ReactNode
  onShow: () => void
  onHide: () => void
  onStop: () => void
  onFocus: () => void
}) {
  if (!shown) {
    return (
      <div data-self-preview="hidden" className="grid size-full place-content-center justify-items-center gap-2 rounded-[12px] bg-surface p-2 text-center">
        <p className="flex items-center gap-1.5 t-small text-text"><span className="tally-dot" />Você está ao vivo</p>
        <Button variant="secondary" size="sm" className="h-7 gap-1.5 rounded-full px-3 t-small" onClick={onShow}>
          <Eye className="size-3.5" />Ver minha tela
        </Button>
      </div>
    )
  }
  return (
    <div data-self-preview="shown" className="group/self relative size-full">
      <button type="button" className="size-full rounded-[12px]" aria-label="Destacar minha tela" onClick={onFocus}>{tile}</button>
      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity duration-160 group-focus-within/self:opacity-100 group-hover/self:opacity-100">
        <Tip label="Esconder minha tela">
          <Button variant="video" size="icon-sm" className="size-7" aria-label="Esconder minha tela" onClick={onHide}><EyeOff className="size-3.5" /></Button>
        </Tip>
        <Tip label="Parar de mostrar">
          <Button variant="video" size="icon-sm" className="size-7" aria-label="Parar de mostrar" onClick={onStop}><MonitorOff className="size-3.5" /></Button>
        </Tip>
      </div>
    </div>
  )
}
