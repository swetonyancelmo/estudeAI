"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BarLink {
  href: string;
  /** Rótulo curto (celular e leitor de tela): "Anterior", "Voltar à aula". */
  label: string;
  /** Título do destino, mostrado truncado no desktop. */
  title?: string;
  /** Mostra o atalho Alt+seta no Tooltip. */
  shortcut?: boolean;
}

/** Altura da barra; o conteúdo da página ganha o mesmo `padding-bottom`. */
export const BOTTOM_BAR_PADDING = "pb-[calc(4rem+env(safe-area-inset-bottom)+2rem)]";

/**
 * Barra fixa da sala de estudo (D10): Anterior, Concluir tópico e Próximo,
 * sempre à mão. Concluir continua manual (D11): `suggestion` só destaca o
 * botão e mostra um convite acima dele, nunca conclui sozinho.
 *
 * Enquanto está na tela, sobe os toasts para não ficarem atrás dela (a
 * variável `--bottom-bar` é lida pelo `Toaster`).
 */
export function StudyBottomBar({
  previous,
  next,
  completed,
  onToggleComplete,
  suggestion,
}: {
  previous: BarLink | null;
  next: BarLink | null;
  completed: boolean;
  onToggleComplete: () => void;
  /** Texto do convite para concluir; nulo quando não há o que sugerir. */
  suggestion?: string | null;
}) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--bottom-bar", "4rem");
    return () => {
      root.style.removeProperty("--bottom-bar");
    };
  }, []);

  return (
    <nav
      aria-label="Navegação entre tópicos"
      className="bg-card fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_0_var(--border)]"
    >
      <p
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-full flex justify-center px-4 pb-2",
          !suggestion && "sr-only",
        )}
      >
        {suggestion && (
          <span className="border-border bg-card rounded-md border px-3 py-2 text-center text-sm font-medium shadow-[0_3px_0_var(--border)]">
            {suggestion}
          </span>
        )}
      </p>

      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6">
        <div className="flex min-w-0 flex-1">
          {previous && <BarNavLink link={previous} direction="previous" />}
        </div>

        <Tooltip disabled={!completed}>
          <TooltipTrigger
            render={
              <Button
                variant={completed ? "outline" : "default"}
                onClick={onToggleComplete}
                aria-label={
                  completed ? "Tópico concluído. Desfazer conclusão" : "Concluir tópico"
                }
                className={cn(
                  "shrink-0 px-4 sm:px-5",
                  suggestion && "animate-[station-pop_0.3s_ease-out]",
                )}
              />
            }
          >
            <Check className="size-4" strokeWidth={completed ? 3 : 2} />
            {completed ? (
              "Concluído"
            ) : (
              <>
                <span className="sm:hidden">Concluir</span>
                <span className="hidden sm:inline">Concluir tópico</span>
              </>
            )}
          </TooltipTrigger>
          <TooltipContent>Clique para desfazer a conclusão</TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 justify-end">
          {next && <BarNavLink link={next} direction="next" />}
        </div>
      </div>
    </nav>
  );
}

function BarNavLink({
  link,
  direction,
}: {
  link: BarLink;
  direction: "previous" | "next";
}) {
  const isNext = direction === "next";
  const Icon = isNext ? ArrowRight : ArrowLeft;
  const className = cn(
    buttonVariants({ variant: isNext ? "outline" : "ghost" }),
    "max-w-full min-w-0 px-3 sm:px-4",
  );

  const content = (
    <>
      {!isNext && <Icon className="size-4" />}
      <span className="lg:hidden">{link.label}</span>
      <span className="hidden min-w-0 truncate lg:inline">
        {link.title ? `${link.label}: ${link.title}` : link.label}
      </span>
      {isNext && <Icon className="size-4" />}
    </>
  );

  if (!link.shortcut) {
    return (
      <Link href={link.href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<Link href={link.href} className={className} />}>
        {content}
      </TooltipTrigger>
      <TooltipContent>
        {isNext ? "Próxima parada" : "Parada anterior"}
        <KbdGroup>
          <Kbd>Alt</Kbd>
          <Kbd>{isNext ? "→" : "←"}</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
