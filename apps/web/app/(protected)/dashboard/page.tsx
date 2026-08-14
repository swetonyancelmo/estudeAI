"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import type { RoadmapListItemDto } from "@estudeai/shared-types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoadmapRouteEmpty } from "@/components/brand/roadmap-route";
import { RoadmapCard } from "@/components/roadmap/roadmap-card";
import { useRoadmaps } from "@/lib/roadmaps/api";

/**
 * "Meus Roadmaps" (FR-03.2). Quem ainda não gerou nenhum continua vendo o
 * convite ao diagnóstico — a lista não substitui o onboarding, ela aparece
 * quando existe o que listar.
 */
export default function DashboardPage() {
  const { data: roadmaps, isPending, isError } = useRoadmaps();

  return (
    <div className="flex flex-1 flex-col px-6 py-11 sm:px-10">
      <div className="mx-auto w-full max-w-[880px]">
        {isPending && <ListSkeleton />}
        {isError && (
          <p className="text-muted-foreground text-sm">
            Não foi possível carregar seus roadmaps. Recarregue a página.
          </p>
        )}
        {roadmaps &&
          (roadmaps.length === 0 ? <EmptyState /> : <List roadmaps={roadmaps} />)}
      </div>
    </div>
  );
}

function List({ roadmaps }: { roadmaps: RoadmapListItemDto[] }) {
  return (
    <div className="flex flex-col gap-7 duration-300 animate-in fade-in-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow text-muted-foreground">Seus estudos</span>
          <h1 className="mt-2.5 text-[26px] font-bold">Meus roadmaps</h1>
        </div>
        <Link
          href="/wizard"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 rounded-md px-4 text-[14.5px] font-semibold",
          )}
        >
          <Plus className="size-4" />
          Novo roadmap
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
    <>
      <span className="eyebrow text-muted-foreground">Bem-vindo(a) de volta</span>
      <h1 className="mt-2.5 mb-2.5 text-[26px] font-bold">
        Vamos montar seu primeiro roadmap?
      </h1>
      <p className="text-muted-foreground max-w-[460px] text-[14.5px]">
        Você ainda não fez o diagnóstico. Leva uns 2 minutos e a IA já monta seu
        roadmap completo em seguida.
      </p>

      <div className="border-border bg-card mt-8 flex flex-wrap items-center justify-between gap-6 rounded-2xl border p-9">
        <div className="min-w-[280px] flex-1 opacity-90">
          <RoadmapRouteEmpty />
        </div>
        <div className="flex min-w-[200px] flex-col items-start gap-3">
          <Link
            href="/wizard"
            className={cn(
              buttonVariants(),
              "h-11 rounded-md px-5 text-[15px] font-semibold",
            )}
          >
            Montar meu roadmap
          </Link>
          <span className="text-ink-faint text-[12.5px]">
            4 perguntas rápidas
          </span>
        </div>
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-7" aria-busy="true">
      <div className="bg-muted h-9 w-56 animate-pulse rounded-md" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <div
            key={index}
            className="bg-muted h-36 animate-pulse rounded-2xl"
          />
        ))}
      </div>
    </div>
  );
}
