import { Camera, ChevronDown, Monitor, Settings, Volume2 } from 'lucide-react'

const Bar = ({ w, tone = 'text-3' }: { w: number; tone?: 'text-2' | 'text-3' }) => (
  <span className="block h-2 rounded-full" style={{ width: w, background: `var(--${tone})`, opacity: tone === 'text-3' ? 0.5 : 0.7 }} />
)

function Person({ w, live }: { w: number; live?: boolean }) {
  return (
    <div className="flex h-9 items-center gap-2.5 rounded-sm px-3">
      <span className="size-6 rounded-full bg-surface-2" />
      <Bar w={w} tone="text-2" />
      {live && <span className="tally-dot ml-1" />}
    </div>
  )
}

function ScreenFrame({ live }: { live?: boolean }) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-[12px] bg-surface">
      <div className="absolute inset-x-4 top-4 grid gap-2">
        <Bar w={96} />
        <Bar w={64} />
      </div>
      <div className="absolute bottom-3 left-3 flex h-6 items-center gap-1.5 rounded-full bg-(--chip-on-video) px-2.5">
        {live && <span className="tally-dot" />}
        <Bar w={40} tone="text-2" />
      </div>
    </div>
  )
}

/** A still picture of the room, built from the room's own geometry. Decorative. */
export function Miniature() {
  return (
    <div aria-hidden="true" className="dark pointer-events-none select-none">
      <div
        className="flex w-[700px] origin-top-left scale-[1.3] rounded-tl-[20px] border-t border-l border-hairline bg-page text-text shadow-3 max-md:scale-100"
        style={{ height: 'var(--mini-h, 560px)' }}
      >
        <aside className="flex w-[200px] flex-none flex-col gap-3 p-2">
          <div className="flex h-10 items-center px-3 t-heading">Telão</div>
          <div className="px-3"><Bar w={52} /></div>
          <div className="grid gap-0.5">
            <Person w={72} live />
            <Person w={56} />
            <Person w={88} />
          </div>
        </aside>
        <div className="flex-1 py-2 pr-2">
          <div className="relative flex h-full flex-col rounded-[20px] bg-stage p-2 pb-[76px]">
            <div className="grid flex-1 grid-cols-2 content-center gap-2 max-md:content-start">
              <ScreenFrame live />
              <ScreenFrame />
            </div>
            <div className="absolute inset-x-0 bottom-10 flex justify-center">
              <div className="flex h-[52px] items-center gap-1 rounded-full border border-hairline bg-surface/90 p-1.5 text-text-2 shadow-2">
                {[Monitor, Camera].map((Icon, i) => (
                  <span key={i} className="relative flex items-center">
                    <span className="grid size-10 place-items-center"><Icon className="size-[18px]" strokeWidth={1.75} /></span>
                    <span className="h-5 w-px bg-border-strong" />
                    <span className="grid h-10 w-6 place-items-center"><ChevronDown className="size-3.5" strokeWidth={1.75} /></span>
                  </span>
                ))}
                {[Volume2, Settings].map((Icon, i) => (
                  <span key={i} className="grid size-10 place-items-center"><Icon className="size-[18px]" strokeWidth={1.75} /></span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
