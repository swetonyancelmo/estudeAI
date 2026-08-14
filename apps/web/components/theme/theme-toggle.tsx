"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/** Nunca emite mudança: só serve para diferenciar servidor de cliente. */
const neverChanges = () => () => {};

/** Ciclo do controle. `system` fica no fim para continuar alcançável. */
const ORDER = ["light", "dark", "system"] as const;
type Mode = (typeof ORDER)[number];

const MODES: Record<Mode, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: "claro" },
  dark: { icon: Moon, label: "escuro" },
  system: { icon: Monitor, label: "do sistema" },
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  // O servidor não conhece o tema escolhido. Antes da hidratação o botão sai
  // genérico — ícone, rótulo e title dependem todos do tema, e o React NÃO
  // corrige atributos divergentes: anunciar o estado errado ficaria permanente.
  const hydrated = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  const current: Mode = ORDER.includes(theme as Mode) ? (theme as Mode) : "system";
  const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  const Icon = MODES[current].icon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={
        hydrated
          ? `Tema ${MODES[current].label}. Mudar para tema ${MODES[next].label}.`
          : "Alternar tema"
      }
      title={hydrated ? `Tema ${MODES[current].label}` : undefined}
      className={cn(
        "text-muted-foreground hover:text-foreground hover:bg-muted flex size-8 items-center justify-center rounded-md transition-colors",
        className,
      )}
    >
      {hydrated && <Icon className="size-4" aria-hidden="true" />}
    </button>
  );
}
