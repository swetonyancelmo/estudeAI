"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRoadmap, useToggleTopic } from "@/lib/roadmaps/api";
import { AREA_LABELS } from "@/lib/roadmaps/labels";
import { ProgressBar } from "./progress-bar";
import { TopicCheckbox } from "./topic-checkbox";

/**
 * Detalhe do roadmap persistido (FR-03.2 + FR-03.3): módulos, tópicos com
 * checkbox e a barra geral. A barra lê o mesmo `progress` do cache que a
 * mutation otimista recalcula, então ela sobe junto com o check — sem esperar
 * o servidor e sem um segundo cálculo próprio aqui.
 */
export function RoadmapDetail({ roadmapId }: { roadmapId: string }) {
  const { data: roadmap, isPending, isError, error } = useRoadmap(roadmapId);
  const toggle = useToggleTopic(roadmapId);

  if (isPending) {
    return <DetailSkeleton />;
  }

  if (isError) {
    return <DetailError error={error} />;
  }

  return (
    <div className="flex flex-col gap-7 duration-300 animate-in fade-in-0">
      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Meus roadmaps
        </Link>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="eyebrow text-muted-foreground">Área sugerida</span>
            <Badge>{AREA_LABELS[roadmap.targetArea]}</Badge>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {roadmap.justification}
          </p>
        </div>

        <div className="border-border bg-card rounded-2xl border p-5">
          <ProgressBar progress={roadmap.progress} showCount />
        </div>

        {toggle.isError && (
          <p className="text-destructive flex items-center gap-2 text-sm">
            <AlertCircle className="size-4 shrink-0" />
            Não foi possível salvar essa alteração. Tente novamente.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {roadmap.modules.map((module) => (
          <Card key={module.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-muted-foreground font-mono tabular-nums">
                  {String(module.order + 1).padStart(2, "0")}
                </span>
                {module.title}
              </CardTitle>
              <p className="text-muted-foreground text-sm">
                {module.description}
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col">
                {module.topics.map((topic) => (
                  <TopicCheckbox
                    key={topic.id}
                    topic={topic}
                    onToggle={toggle.mutate}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="bg-muted h-4 w-32 animate-pulse rounded-md" />
      <div className="bg-muted h-16 w-full animate-pulse rounded-2xl" />
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="bg-muted h-40 w-full animate-pulse rounded-xl"
        />
      ))}
    </div>
  );
}

/** 403 (roadmap de outro usuário) e 404 têm o mesmo desfecho útil: voltar. */
function DetailError({ error }: { error: unknown }) {
  const status =
    typeof error === "object" && error !== null
      ? (error as { response?: { status?: number } }).response?.status
      : undefined;

  const message =
    status === 403 || status === 404
      ? "Este roadmap não está disponível na sua conta."
      : "Não foi possível carregar este roadmap.";

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button variant="outline" render={<Link href="/dashboard" />}>
        <ArrowLeft className="size-4" />
        Voltar para meus roadmaps
      </Button>
    </div>
  );
}
