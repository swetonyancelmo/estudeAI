"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import type { AdjustmentChangesDto } from "@estudeai/shared-types";
import { Button } from "@/components/ui/button";
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
  /** Sobe o resultado para o detalhe destacar o que mudou. */
  onAdjusted: (changes: AdjustmentChangesDto) => void;
}

/**
 * FR-04.1 — pedido de reajuste em linguagem natural.
 *
 * A chamada passa pela IA e demora alguns segundos, então o estado de loading é
 * explícito (botão travado + aviso), e o erro é tratado como parte normal do
 * fluxo: quando o backend recusa a resposta da IA por integridade (422), a
 * mensagem já vem pronta do servidor sugerindo reformular o pedido.
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
        onAdjusted(response.changes);
        setRequest("");
        setIsOpen(false);
      },
    });
  }

  function handleClose() {
    setIsOpen(false);
    adjust.reset();
  }

  if (!isOpen) {
    return (
      <div className="flex flex-col gap-3">
        <Button variant="outline" onClick={() => setIsOpen(true)}>
          <Wand2 className="size-4" />
          Reajustar roadmap
        </Button>

        {adjust.isSuccess && (
          <p className="border-success/30 bg-success/5 text-muted-foreground rounded-xl border p-3 text-sm leading-relaxed">
            <Sparkles className="text-success mr-1.5 inline size-4 align-text-bottom" />
            {adjust.data.adjustmentSummary}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-5 duration-200 animate-in fade-in-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-sm font-medium">
            Reajustar roadmap
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Conte como sua rotina mudou. A IA reorganiza o que falta — os
            tópicos que você já concluiu ficam como estão.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleClose}
          aria-label="Fechar"
          disabled={adjust.isPending}
        >
          <X className="size-4" />
        </Button>
      </div>

      <Textarea
        value={request}
        onChange={(event) => setRequest(event.target.value.slice(0, MAX_LENGTH))}
        placeholder="Ex.: tenho menos tempo esta semana, só consigo estudar 3h"
        disabled={adjust.isPending}
        aria-label="Pedido de reajuste"
      />

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <Button
            key={example}
            variant="ghost"
            size="xs"
            disabled={adjust.isPending}
            onClick={() => setRequest(example)}
          >
            {example}
          </Button>
        ))}
      </div>

      {adjust.isError && (
        <p
          className="text-destructive flex items-start gap-2 text-sm leading-relaxed"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {extractApiError(
            adjust.error,
            "Não foi possível reajustar seu roadmap. Tente novamente.",
          )}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-ink-faint font-mono text-xs tabular-nums">
          {request.length}/{MAX_LENGTH}
        </span>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {adjust.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Recalculando…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Reajustar
            </>
          )}
        </Button>
      </div>

      {adjust.isPending && (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          A IA está recalculando o que falta do seu roadmap. Isso leva alguns
          segundos.
        </p>
      )}
    </div>
  );
}
