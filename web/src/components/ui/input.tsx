import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-md border border-hairline bg-surface px-3.5 t-body text-text shadow-1 transition-colors outline-none placeholder:text-text-3 hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-blue disabled:pointer-events-none disabled:opacity-40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
