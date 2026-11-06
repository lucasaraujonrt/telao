import { cn } from "cn"
import * as ResizablePrimitive from "react-resizable-panels"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

/**
 * The 8 px gap between two panels is the handle. It stays invisible until the pointer is over it,
 * then shows a 2 px line: a quiet gray on hover, the accent while dragging or focused.
 */
function ResizableHandle({
  className,
  ...props
}: ResizablePrimitive.SeparatorProps) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "group/handle relative flex-none outline-none",
        "aria-[orientation=vertical]:w-2 aria-[orientation=horizontal]:h-2",
        "after:pointer-events-none after:absolute after:rounded-full after:bg-transparent after:transition-colors after:duration-160",
        "aria-[orientation=vertical]:after:inset-y-1 aria-[orientation=vertical]:after:left-[3px] aria-[orientation=vertical]:after:w-0.5",
        "aria-[orientation=horizontal]:after:inset-x-1 aria-[orientation=horizontal]:after:top-[3px] aria-[orientation=horizontal]:after:h-0.5",
        "data-[separator=hover]:after:bg-border-strong data-[separator=active]:after:bg-accent-blue data-[separator=focus]:after:bg-accent-blue",
        className
      )}
      {...props}
    />
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
