"use client";

import Link from "next/link";
import { AlertCircle, Plus } from "lucide-react";
import type { RoadmapListItemDto } from "@estudeai/shared-types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteLine } from "@/components/brand/route-line";
import { RoadmapCard } from "@/components/roadmap/roadmap-card";
import { ReviewTodayCard } from "@/components/review/review-today-card";
import { useRoadmaps } from "@/lib/roadmaps/api";

/**
 * "Meus Roadmaps" (FR-03.2). Quem ainda não gerou nenhum continua vendo o
 * convite ao diagnóstico — a lista não substitui o onboarding, ela aparece
 * quando existe o que listar.
 */
export default function DashboardPage() {
  const { data: roadmaps, isPending, isError } = useRoadmaps();

  return (
    <div className="flex flex-1 flex-col px-5 py-10 sm:px-10 sm:py-14">
      <div className="mx-auto w-full max-w-4xl">
        {isPending && <ListSkeleton />}
        {isError && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertDescription>
              Não foi possível carregar seus roadmaps. Recarregue a página.
            </AlertDescription>
          </Alert>
        )}
        {roadmaps &&
          (roadmaps.length === 0 ? <EmptyState /> : <List roadmaps={roadmaps} />)}
      </div>
    </div>
  );
}

function List({ roadmaps }: { roadmaps: RoadmapListItemDto[] }) {
  // Sem nenhum roadmap em andamento, criar um novo vira a ação principal.
  const hasActive = roadmaps.some(
    (roadmap) => roadmap.status === "active" && roadmap.progress.percent < 100,
  );

  return (
    <div className="flex flex-col gap-8 duration-300 animate-in fade-in-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1>Meus roadmaps</h1>
          <p className="text-muted-foreground">
            {roadmaps.length === 1
              ? "Uma rota no seu mapa. Siga de onde parou."
              : `${roadmaps.length} rotas no seu mapa. Siga de onde parou.`}
          </p>
        </div>
        <Link
          href="/wizard"
          className={buttonVariants({ variant: hasActive ? "outline" : "default" })}
        >
          <Plus className="size-4" />
          Novo roadmap
        </Link>
      </div>

      <ReviewTodayCard />

      <div className="grid gap-5 sm:grid-cols-2">
        {roadmaps.map((roadmap) => (
          <RoadmapCard key={roadmap.id} roadmap={roadmap} />
        ))}
      </div>
    </div>
  );
}

/** Estado inicial: ninguém tem roadmap antes de fazer o diagnóstico. */
function EmptyState() {
  return (
    <div className="flex flex-col gap-10 duration-300 animate-in fade-in-0">
      <div className="flex flex-col gap-3">
        <h1>Seu mapa ainda está em branco.</h1>
        <p className="text-muted-foreground max-w-md text-lg">
          São até 6 perguntas sobre seu objetivo, seu tempo e o que você já
          sabe. Em uns 2 minutos você
          sai com a rota completa, módulo por módulo.
        </p>
      </div>

      <div className="border-border bg-card flex flex-col gap-8 rounded-lg border p-6 sm:p-10">
        <RouteLine
          stops={5}
          reached={0}
          startLabel="você está aqui"
          endLabel="1º projeto"
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Link href="/wizard" className={buttonVariants()}>
            Montar meu roadmap
          </Link>
          <span className="data-label text-ink-faint">até 6 perguntas · ~2 min</span>
        </div>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <Skeleton className="h-10 w-64 rounded-lg" />
      <div className="grid gap-5 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <Skeleton key={index} className="h-52 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
