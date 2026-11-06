import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "press group/button inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-clip-padding t-body font-[550] select-none disabled:pointer-events-none data-[disabled]:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px] [&_svg]:stroke-[1.75]",
  {
    variants: {
      variant: {
        primary:
          "bg-accent-blue text-white shadow-accent hover:bg-accent-hover disabled:opacity-40 disabled:shadow-none data-[disabled]:opacity-40 data-[disabled]:shadow-none",
        secondary:
          "border-hairline bg-surface text-text shadow-1 hover:bg-surface-2 disabled:text-text-3",
        ghost: "bg-transparent text-text hover:bg-surface-2 disabled:text-text-3",
        icon:
          "rounded-full bg-transparent text-text-2 hover:bg-surface-2 hover:text-text aria-pressed:bg-accent-soft aria-pressed:text-accent-blue aria-expanded:bg-surface-2 aria-expanded:text-text disabled:text-text-3 data-[disabled]:text-text-3",
        video:
          "rounded-full bg-(--chip-on-video) text-white backdrop-blur-md hover:bg-black/80 [&_svg:not([class*='size-'])]:size-4",
      },
      size: {
        default: "h-10 px-4",
        lg: "h-11 px-5",
        sm: "h-9 px-3",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
