"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { AdjustmentChangesDto } from "@estudeai/shared-types";
import { RerouteIcon } from "@/components/brand/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { extractApiError } from "@/lib/auth/actions";
import { useAdjustRoadmap } from "@/lib/roadmaps/api";

const MAX_LENGTH = 500;

/** Atalhos para os dois pedidos citados no FR-04.1. */
const EXAMPLES = [
  "Tenho menos tempo esta semana",
  "Quero acelerar o módulo atual",
] as const;

interface RoadmapAdjustPanelProps {
  roadmapId: string;
  /**
   * Sobe o resultado para o detalhe destacar o que mudou e mostrar o resumo
   * (um `Alert` no topo da linha).
   */
  onAdjusted: (changes: AdjustmentChangesDto, summary: string) => void;
}

/**
 * FR-04.1 — pedido de reajuste em linguagem natural ("reajustar a rota").
 *
 * A chamada passa pela IA e demora alguns segundos, então o estado de loading é
 * explícito (botão travado + aviso), e o erro é tratado como parte normal do
 * fluxo: quando o backend recusa a resposta da IA por integridade (422), a
 * mensagem já vem pronta do servidor sugerindo reformular o pedido.
 *
 * Redesign v2 (Fase 3): o formulário mora num `Sheet` aberto pelo botão
 * "Reajustar rota", em vez de abrir no meio da página e empurrar a linha. O
 * resumo do reajuste saiu daqui: o detalhe o mostra no topo da linha.
 */
export function RoadmapAdjustPanel({
  roadmapId,
  onAdjusted,
}: RoadmapAdjustPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState("");
  const adjust = useAdjustRoadmap(roadmapId);

  const canSubmit = request.trim().length >= 5 && !adjust.isPending;

  function handleSubmit() {
    if (!canSubmit) return;

    adjust.mutate(request.trim(), {
      onSuccess: (response) => {
        onAdjusted(response.changes, response.adjustmentSummary);
        setRequest("");
        setIsOpen(false);
      },
    });
  }

  function handleOpenChange(open: boolean) {
    // Enquanto recalcula, o Sheet não fecha: o resultado chega nele.
    if (!open && adjust.isPending) return;
    setIsOpen(open);
    if (!open) adjust.reset();
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetTrigger render={<Button variant="outline" />}>
          <RerouteIcon />
          Reajustar rota
        </SheetTrigger>
        <SheetContent
          side="right"
          className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle className="text-xl">Reajustar rota</SheetTitle>
            <SheetDescription>
              Conte como sua rotina mudou. Só o que falta é reorganizado: os
              tópicos que você já concluiu ficam como estão.
            </SheetDescription>
          </SheetHeader>

          <form
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <Textarea
              value={request}
              onChange={(event) => setRequest(event.target.value.slice(0, MAX_LENGTH))}
              placeholder="Ex.: tenho menos tempo esta semana, só consigo estudar 3h"
              disabled={adjust.isPending}
              aria-label="Pedido de reajuste"
              className="min-h-32"
            />

            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((example) => (
                <Button
                  key={example}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={adjust.isPending}
                  onClick={() => setRequest(example)}
                >
                  {example}
                </Button>
              ))}
            </div>

            {adjust.isError && (
              <Alert variant="destructive">
                <AlertTriangle />
                <AlertDescription>
                  {extractApiError(
                    adjust.error,
                    "Não foi possível reajustar seu roadmap. Tente novamente.",
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="data-label text-ink-faint">
                {request.length}/{MAX_LENGTH}
              </span>
              <Button type="submit" disabled={!canSubmit}>
                {adjust.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Recalculando…
                  </>
                ) : (
                  <>
                    <RerouteIcon />
                    Reajustar
                  </>
                )}
              </Button>
            </div>

            {adjust.isPending && (
              <p className="text-muted-foreground text-sm" aria-live="polite">
                Recalculando o que falta da sua rota. Isso leva alguns segundos.
              </p>
            )}
          </form>
        </SheetContent>
      </Sheet>
      <span className="text-muted-foreground text-sm">
        A rotina mudou? Recalcule o que falta.
      </span>
    </div>
  );
}
