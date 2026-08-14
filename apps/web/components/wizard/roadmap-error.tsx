import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractApiError } from "@/lib/auth/actions";

interface RoadmapErrorProps {
  error: unknown;
  onRetry: () => void;
  onRestart: () => void;
}

/**
 * Tela de erro da geração (FR-02.1): Gemini fora do ar, timeout ou resposta
 * inválida. A mensagem vem do backend padronizado (503/504/502) via
 * `extractApiError`, com fallback genérico. Oferece "Tentar novamente" (refaz a
 * mesma chamada, sem perder as respostas) e "Refazer diagnóstico" (recomeça).
 */
export function RoadmapError({ error, onRetry, onRestart }: RoadmapErrorProps) {
  const message = extractApiError(
    error,
    "Não foi possível gerar seu roadmap. Tente novamente.",
  );

  return (
    <div
      className="flex flex-col items-center gap-6 py-8 text-center duration-300 animate-in fade-in-0"
      role="alert"
    >
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-lg font-medium">
          Não deu para gerar seu roadmap
        </h2>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          {message}
        </p>
      </div>

      <div className="flex flex-col-reverse items-center gap-3 sm:flex-row">
        <Button variant="ghost" onClick={onRestart}>
          Refazer diagnóstico
        </Button>
        <Button onClick={onRetry}>
          <RefreshCw className="size-4" />
          Tentar novamente
        </Button>
      </div>
    </div>
  );
}
