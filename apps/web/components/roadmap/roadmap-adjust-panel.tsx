"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, ShieldCheck, X } from "lucide-react";
import type { AdjustmentChangesDto } from "@estudeai/shared-types";
import { RerouteIcon } from "@/components/brand/icons";
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
  /** Tópicos concluídos que passaram intactos pelo último reajuste. */
  preservedCount: number;
}

/**
 * FR-04.1 — pedido de reajuste em linguagem natural ("reajustar a rota").
 *
 * A chamada passa pela IA e demora alguns segundos, então o estado de loading é
 * explícito (botão travado + aviso), e o erro é tratado como parte normal do
 * fluxo: quando o backend recusa a resposta da IA por integridade (422), a
 * mensagem já vem pronta do servidor sugerindo reformular o pedido.
 */
export function RoadmapAdjustPanel({
  roadmapId,
  onAdjusted,
  preservedCount,
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
      <div className="flex flex-col gap-4">
        {/* Resumo do último reajuste: aviso no topo da linha, com filete da marca. */}
        {adjust.isSuccess && (
          <div
            className="border-brand bg-brand-soft flex flex-col gap-2 rounded-lg border-l-[3px] p-4"
            role="status"
          >
            <p className="flex items-center gap-2 font-semibold">
              <RerouteIcon className="text-brand-ink size-5" />
              Rota reajustada
            </p>
            <p className="text-muted-foreground text-sm">
              {adjust.data.adjustmentSummary}
            </p>
            {preservedCount > 0 && (
              <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <ShieldCheck className="text-success-ink size-4 shrink-0" />
                {preservedCount}{" "}
                {preservedCount === 1
                  ? "tópico concluído foi preservado."
                  : "tópicos concluídos foram preservados."}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button variant="outline" onClick={() => setIsOpen(true)}>
            <RerouteIcon />
            Reajustar rota
          </Button>
          <span className="text-ink-faint text-sm">
            A rotina mudou? Recalcule o que falta.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5 duration-200 animate-in fade-in-0 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-xl">Reajustar rota</h2>
          <p className="text-muted-foreground text-sm">
            Conte como sua rotina mudou. Só o que falta é reorganizado: os
            tópicos que você já concluiu ficam como estão.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mt-2 -mr-2"
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
        <p className="text-destructive flex items-start gap-2 text-sm" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {extractApiError(
            adjust.error,
            "Não foi possível reajustar seu roadmap. Tente novamente.",
          )}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="data-label text-ink-faint">
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
    </div>
  );
}
