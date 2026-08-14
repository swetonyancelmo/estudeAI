import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoadmapRouteEmpty } from "@/components/brand/roadmap-route";

export default function DashboardPage() {
  return (
    <div className="flex flex-1 flex-col px-6 py-11 sm:px-10">
      <div className="mx-auto w-full max-w-[880px]">
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
            <span className="text-ink-faint text-[12.5px]">4 perguntas rápidas</span>
          </div>
        </div>
      </div>
    </div>
  );
}
