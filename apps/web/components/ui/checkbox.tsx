"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Checkbox da marca: marcador de 20px que acende na cor da linha (`--line`;
 * fora de `.track-*` ela é a cor da marca). O `after:` estende a área de toque
 * para 44px sem mudar o tamanho visual.
 *
 * Contraste do check sobre `bg-line`: branco no claro (3.5:1 a 6.1:1 nas quatro
 * trilhas) e tinta no escuro (5.6:1 a 9.3:1). Branco no escuro falharia
 * (1.9:1 no DevOps), por isso a troca por tema.
 */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-5 shrink-0 items-center justify-center rounded-sm border-2 border-input bg-card transition-colors outline-none after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-x-1/2 after:-translate-y-1/2 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:border-line data-checked:bg-line data-checked:text-white dark:data-checked:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon strokeWidth={3.5} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
