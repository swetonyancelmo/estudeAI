"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { extractApiError } from "@/lib/auth/actions";
import { useDeleteRoadmap } from "@/lib/roadmaps/api";

/**
 * Exclusão do roadmap, em dois passos: o primeiro clique só arma a confirmação,
 * o segundo apaga. Confirmação inline em vez de modal porque o projeto não tem
 * componente de diálogo — e um passo a mais no mesmo lugar resolve o problema
 * real (evitar o clique acidental) sem introduzir uma camada de UI nova.
 *
 * Some tudo: roadmap, módulos, tópicos e o progresso marcado. Por isso o texto
 * de confirmação diz isso explicitamente, em vez de um "tem certeza?" genérico.
 */
export function DeleteRoadmapButton({ roadmapId }: { roadmapId: string }) {
  const [isConfirming, setIsConfirming] = useState(false);
  const router = useRouter();
  const remove = useDeleteRoadmap(roadmapId);

  function handleDelete() {
    remove.mutate(undefined, {
      onSuccess: () => router.replace("/dashboard"),
    });
  }

  if (!isConfirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive w-fit"
        onClick={() => setIsConfirming(true)}
      >
        <Trash2 className="size-3.5" />
        Excluir roadmap
      </Button>
    );
  }

  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-4 duration-200 animate-in fade-in-0">
      <p className="text-muted-foreground text-sm leading-relaxed">
        Excluir este roadmap apaga também todos os módulos, tópicos e o
        progresso que você já marcou. Não dá para desfazer.
      </p>

      {remove.isError && (
        <p
          className="text-destructive flex items-start gap-2 text-sm"
          role="alert"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {extractApiError(
            remove.error,
            "Não foi possível excluir este roadmap. Tente novamente.",
          )}
        </p>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={remove.isPending}
        >
          {remove.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Excluindo…
            </>
          ) : (
            <>
              <Trash2 className="size-3.5" />
              Excluir definitivamente
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsConfirming(false);
            remove.reset();
          }}
          disabled={remove.isPending}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
