"use client";

import { useEffect, useState } from "react";
import { UNDECIDED_AREA, type WizardAnswers } from "@estudeai/shared-types";
import { optionLabel, type SingleField } from "@/lib/wizard/steps";

/** Rótulo da opção escolhida num campo ("entrar no mercado", "cerca de 15h"…). */
function labelOf(field: SingleField, answers: WizardAnswers): string {
  return optionLabel(field, answers[field]).toLowerCase();
}

/** Como a trilha foi decidida: pela área escolhida ou pela afinidade. */
function trackStage(answers: WizardAnswers): string {
  return answers.area === UNDECIDED_AREA
    ? `Escolhendo a trilha a partir de: ${labelOf("affinity", answers)}`
    : `Abrindo a trilha de ${optionLabel("area", answers.area)}`;
}

function skillsStage(answers: WizardAnswers): string {
  const count = answers.knownSkills.length;
  if (count === 0) return "Partindo do básico, do zero";
  return `Marcando como concluído o que você já sabe (${count} ${
    count === 1 ? "habilidade" : "habilidades"
  })`;
}

/** Intervalo entre as etapas narradas. A última fica até a resposta chegar. */
const STAGE_INTERVAL_MS = 1300;

/**
 * Tela de espera da geração (FR-02.1). O roadmap sai de uma trilha curada e só
 * a justificativa passa pela IA, então a espera é de poucos segundos — ainda
 * assim ela vira um momento do produto: a rota vai sendo traçada e cada etapa
 * narrada cita uma resposta do próprio usuário, deixando claro que algo
 * específico para ele está sendo montado.
 *
 * As etapas são um roteiro local (não vêm do servidor): servem para dar ritmo
 * à espera, e por isso a última não promete conclusão, só "quase lá".
 */
export function RoadmapGenerating({ answers }: { answers: WizardAnswers }) {
  const stages = [
    `Lendo seu objetivo: ${labelOf("goal", answers)}`,
    trackStage(answers),
    skillsStage(answers),
    `Dimensionando a carga para ${labelOf("weeklyTime", answers)} por semana`,
    `Ordenando os materiais no estilo ${labelOf("learningStyle", answers)}`,
    "Quase lá, fechando a rota",
  ];

  const [stage, setStage] = useState(0);
  const lastStage = stages.length - 1;

  useEffect(() => {
    if (stage >= lastStage) return;
    const timer = setTimeout(() => setStage(stage + 1), STAGE_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [stage, lastStage]);

  return (
    <div
      className="flex flex-col gap-10 duration-300 animate-in fade-in-0"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col gap-3">
        <h1>Traçando sua rota</h1>
        <p className="text-muted-foreground text-lg">
          Isso leva só alguns segundos.
        </p>
      </div>

      {/* A rota se desenha em loop: tronco, bifurcação nas quatro trilhas, destino. */}
      <svg
        viewBox="0 0 560 150"
        fill="none"
        aria-hidden="true"
        className="h-auto w-full"
      >
        <g className="stroke-input" strokeWidth="3" strokeDasharray="2 8" strokeLinecap="round">
          <path d="M20 75 H160 C230 75 230 15 300 15 C370 15 370 75 440 75 H540" />
          <path d="M160 75 C230 75 230 55 300 55 C370 55 370 75 440 75" />
          <path d="M160 75 C230 75 230 95 300 95 C370 95 370 75 440 75" />
          <path d="M160 75 C230 75 230 135 300 135 C370 135 370 75 440 75" />
        </g>
        <g strokeWidth="3.5" strokeLinecap="round">
          <path
            pathLength={1}
            className="route-draw-loop stroke-line-front"
            d="M20 75 H160 C230 75 230 15 300 15 C370 15 370 75 440 75 H540"
          />
          <path
            pathLength={1}
            className="route-draw-loop stroke-line-back [animation-delay:0.3s]"
            d="M160 75 C230 75 230 55 300 55 C370 55 370 75 440 75"
          />
          <path
            pathLength={1}
            className="route-draw-loop stroke-line-full [animation-delay:0.6s]"
            d="M160 75 C230 75 230 95 300 95 C370 95 370 75 440 75"
          />
          <path
            pathLength={1}
            className="route-draw-loop stroke-line-ops [animation-delay:0.9s]"
            d="M160 75 C230 75 230 135 300 135 C370 135 370 75 440 75"
          />
        </g>
        <circle cx="20" cy="75" r="8" className="fill-brand" />
        <circle cx="160" cy="75" r="7" className="fill-background stroke-foreground" strokeWidth="3" />
        <circle cx="300" cy="15" r="6" className="fill-background stroke-line-front" strokeWidth="3" />
        <circle cx="300" cy="55" r="6" className="fill-background stroke-line-back" strokeWidth="3" />
        <circle cx="300" cy="95" r="6" className="fill-background stroke-line-full" strokeWidth="3" />
        <circle cx="300" cy="135" r="6" className="fill-background stroke-line-ops" strokeWidth="3" />
        <circle cx="440" cy="75" r="7" className="fill-background stroke-foreground" strokeWidth="3" />
        <circle cx="540" cy="75" r="8" className="fill-background stroke-foreground" strokeWidth="3" strokeDasharray="3 4" />
      </svg>

      <ol className="flex flex-col gap-2.5">
        {stages.slice(0, stage + 1).map((text, index) => {
          const isCurrent = index === stage;
          return (
            <li
              key={text}
              className={
                isCurrent
                  ? "flex items-center gap-3 font-medium duration-300 animate-in fade-in-0 slide-in-from-bottom-2"
                  : "text-ink-faint flex items-center gap-3"
              }
            >
              <span
                className={
                  isCurrent
                    ? "bg-brand size-2.5 shrink-0 animate-pulse rounded-full"
                    : "bg-input size-2.5 shrink-0 rounded-full"
                }
                aria-hidden="true"
              />
              {text}
              {isCurrent && "…"}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
