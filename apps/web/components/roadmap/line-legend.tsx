"use client";

import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { StopMarker } from "@/components/study/stop-marker";
import { TerminalMarker } from "./line-stations";

/** Os marcadores reais da linha, com o nome de cada estado (BASE §3.4). */
function LegendItems() {
  return (
    <ul className="data-label text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2.5">
      <li className="flex items-center gap-2">
        <StopMarker state="done" />
        concluída
      </li>
      <li className="flex items-center gap-2">
        <StopMarker state="not_started" current />
        atual
      </li>
      <li className="flex items-center gap-2">
        <StopMarker state="in_progress" />
        em andamento
      </li>
      <li className="flex items-center gap-2">
        <StopMarker state="not_started" />
        não iniciada
      </li>
      <li className="flex items-center gap-2">
        <StopMarker state="not_started" project />
        checkpoint
      </li>
      <li className="flex items-center gap-2">
        <TerminalMarker small />
        fim da linha
      </li>
    </ul>
  );
}

/**
 * Legenda dos estados (D16), logo acima da linha. No celular fica recolhida
 * num `Collapsible`, para não empurrar a linha para baixo da dobra.
 */
export function LineLegend() {
  return (
    <>
      <div className="hidden sm:block" aria-label="Legenda dos marcadores" role="group">
        <LegendItems />
      </div>
      <Collapsible className="sm:hidden">
        <CollapsibleTrigger className="group/legend text-muted-foreground hover:text-foreground flex min-h-11 w-fit cursor-pointer items-center gap-1.5 rounded-md text-sm font-medium transition-colors">
          O que significa cada marcador
          <ChevronDown className="size-4 transition-transform group-data-[panel-open]/legend:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 pb-1">
          <LegendItems />
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
