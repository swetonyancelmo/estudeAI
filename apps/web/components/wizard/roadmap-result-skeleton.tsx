import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/** Uma barrinha cinza pulsante — placeholder de texto enquanto o Gemini responde. */
function Bar({ className }: { className?: string }) {
  return <div className={`bg-muted animate-pulse rounded ${className ?? ""}`} />;
}

/**
 * Tela de carregamento da geração real do roadmap (FR-02.1). Como a chamada ao
 * Gemini demora bem mais que o mock da Etapa 3, mostramos um skeleton com a mesma
 * silhueta da RoadmapResult (área + justificativa + cards de módulo) e um spinner
 * com mensagem — feedback claro de que algo está acontecendo.
 */
export function RoadmapResultSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Gerando seu roadmap personalizado…
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Bar className="h-4 w-24" />
          <Bar className="h-6 w-20" />
        </div>
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-11/12" />
        <Bar className="h-3 w-4/5" />
      </div>

      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <Bar className="h-4 w-1/2" />
              <Bar className="mt-2 h-3 w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Bar className="h-3 w-full" />
                <Bar className="h-3 w-5/6" />
                <Bar className="h-3 w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <span className="sr-only">Gerando roadmap, aguarde.</span>
    </div>
  );
}
