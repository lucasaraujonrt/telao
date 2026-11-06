import { useLayoutEffect, useRef, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'

/**
 * A single-choice segmented control on the shadcn ToggleGroup. The thumb is one element that slides
 * to the selected item, so the change reads as a move rather than a swap. Items may wrap to a
 * second row on a narrow track; the thumb follows in both directions.
 */
export function Segmented<T extends string>({ value, options, onChange, label, disabled, className }: {
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const [thumb, setThumb] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const root = track.current
    if (!root) return
    const place = () => {
      const item = root.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`)
      if (item) setThumb({ x: item.offsetLeft, y: item.offsetTop, w: item.offsetWidth, h: item.offsetHeight })
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(root)
    return () => observer.disconnect()
  }, [value])

  return (
    <ToggleGroup
      ref={track}
      aria-label={label}
      value={[value]}
      onValueChange={next => { const picked = next[0] as T | undefined; if (picked && picked !== value) onChange(picked) }}
      disabled={disabled}
      spacing={0}
      className={cn('relative flex w-full flex-wrap gap-0 rounded-[18px] bg-fill p-[3px]', className)}
    >
      {thumb && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-full bg-(--thumb) shadow-1 transition-[transform,width,height] duration-200 ease-(--ease-out)"
          style={{ width: thumb.w, height: thumb.h, transform: `translate(${thumb.x}px, ${thumb.y}px)` }}
        />
      )}
      {options.map(option => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          data-value={option.value}
          className="relative z-10 h-8 flex-auto rounded-full! px-3 t-small font-[450] text-text-2 transition-colors duration-200 hover:bg-transparent hover:text-text aria-pressed:bg-transparent data-[pressed]:bg-transparent data-[pressed]:font-[550] data-[pressed]:text-text"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
