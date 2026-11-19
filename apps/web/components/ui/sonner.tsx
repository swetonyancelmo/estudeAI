"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CheckIcon, InfoIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react"

/**
 * Toasts da marca: superfície `popover` com a sombra sólida dos menus, tema
 * ligado ao `next-themes`. Sem ícone de sucesso colorido genérico: o check usa
 * a cor da linha (`--line`), que dentro de `.track-*` é a cor da trilha.
 *
 * Posição: embaixo no centro no celular, embaixo à direita no desktop. O
 * Sonner aceita uma posição só; no celular ele já ocupa a largura toda, então
 * "bottom-right" vira, na prática, embaixo e centralizado.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      position="bottom-right"
      // Na sala de estudo a barra fixa (`--bottom-bar`) ocupa o rodapé.
      offset={{ bottom: "calc(var(--bottom-bar, 0px) + 24px)" }}
      mobileOffset={{ bottom: "calc(var(--bottom-bar, 0px) + 16px)" }}
      className="toaster group"
      icons={{
        success: <CheckIcon className="size-4 text-line" strokeWidth={3} />,
        info: <InfoIcon className="size-4 text-muted-foreground" />,
        warning: <TriangleAlertIcon className="size-4 text-brand-ink" />,
        error: <TriangleAlertIcon className="size-4 text-destructive" />,
        loading: (
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "font-sans text-sm shadow-[0_3px_0_var(--border)]! border-border",
          title: "font-semibold",
          description: "text-muted-foreground!",
          actionButton:
            "bg-primary! text-primary-foreground! font-semibold! min-h-9",
          cancelButton: "bg-muted! text-foreground!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
