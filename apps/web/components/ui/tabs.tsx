"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cn } from "@/lib/utils"

/**
 * Abas do redesign v2: sublinhado de 3px na cor da linha (`--line`), não a
 * pílula cinza do shadcn. Fora de uma `.track-*`, `--line` cai na marca.
 * Cada aba tem 44px de altura para o toque.
 */
function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn("group/tabs flex flex-col gap-6", className)}
      {...props}
    />
  )
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "border-border text-muted-foreground flex items-stretch gap-1 border-b",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative -mb-px inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-t-md px-3 text-sm font-semibold whitespace-nowrap transition-colors outline-none",
        "hover:text-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:ring-inset",
        "data-active:text-foreground disabled:pointer-events-none disabled:opacity-50",
        "after:bg-line after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-full after:opacity-0 after:transition-opacity data-active:after:opacity-100",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
