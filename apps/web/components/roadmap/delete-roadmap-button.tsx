"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { extractApiError } from "@/lib/auth/actions";
import { useDeleteRoadmap } from "@/lib/roadmaps/api";

/**
 * Exclusão do roadmap, com confirmação num `AlertDialog`. Antes era inline em
 * dois cliques porque o projeto não tinha componente de diálogo; com o
 * shadcn (redesign v2, Fase 1) o diálogo passa a ser o lugar certo: prende o
 * foco, fecha com Esc e não empurra o layout da página.
 *
 * Some tudo: roadmap, módulos, tópicos e o progresso marcado. Por isso o texto
 * de confirmação diz isso explicitamente, em vez de um "tem certeza?" genérico.
 * O diálogo continua aberto enquanto exclui (e se der erro, para mostrar o
 * erro); só sai da tela quando a exclusão termina e a navegação acontece.
 */
export function DeleteRoadmapButton({ roadmapId }: { roadmapId: string }) {
  const router = useRouter();
  const remove = useDeleteRoadmap(roadmapId);

  function handleDelete() {
    remove.mutate(undefined, {
      onSuccess: () => router.replace("/dashboard"),
    });
  }

  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!open) remove.reset();
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive w-fit"
          />
        }
      >
        <Trash2 className="size-3.5" />
        Excluir roadmap
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir este roadmap?</AlertDialogTitle>
          <AlertDialogDescription>
            Excluir este roadmap apaga também todos os módulos, tópicos e o
            progresso que você já marcou. Não dá para desfazer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {remove.isError && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertDescription>
              {extractApiError(
                remove.error,
                "Não foi possível excluir este roadmap. Tente novamente.",
              )}
            </AlertDescription>
          </Alert>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
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
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
