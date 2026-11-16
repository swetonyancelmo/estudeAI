import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Botão com a linguagem da marca (docs/REDESIGN.md §5): 44px de altura por
 * padrão (área de toque), raio 12 e, no primário, uma "espessura" sólida embaixo
 * que afunda no clique — o toque tátil que substitui o hover lavado do shadcn.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-base font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_3px_0_var(--brand-deep)] hover:brightness-105 active:translate-y-[2px] active:shadow-[0_1px_0_var(--brand-deep)]",
        outline:
          "border-input bg-card text-foreground shadow-[0_2px_0_var(--border)] hover:border-foreground/40 active:translate-y-[1px] active:shadow-none aria-expanded:bg-muted",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] aria-expanded:bg-secondary",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive/30",
        link: "text-brand-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-5",
        lg: "h-12 gap-2 px-6 text-lg",
        sm: "h-9 gap-1.5 px-3.5 text-sm",
        xs: "h-8 gap-1 rounded-md px-2.5 text-sm font-medium [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-11",
        "icon-sm": "size-9",
        "icon-xs": "size-8 rounded-md [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
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
