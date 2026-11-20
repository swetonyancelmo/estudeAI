"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { useAuthStore } from "@/lib/auth/store";
import { refreshSession } from "@/lib/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fonte da verdade da proteção de rota (funciona cross-domain, ao contrário do
 * proxy.ts otimista). Reage ao status da sessão:
 * - idle/loading: mostra o esqueleto da página enquanto o bootstrap decide
 *   (redesign v2: `Skeleton` no lugar do spinner, como o resto do app);
 * - unauthenticated: redireciona para /login;
 * - unavailable: a API não respondeu (limite, rede); oferece tentar de novo,
 *   sem mandar para o /login (o proxy devolveria para cá, em loop);
 * - authenticated: renderiza o conteúdo protegido.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "authenticated") {
    return <>{children}</>;
  }

  if (status === "unavailable") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 sm:p-16">
        <Alert className="max-w-md">
          <AlertCircle />
          <AlertTitle>Não foi possível confirmar sua sessão agora.</AlertTitle>
          <AlertDescription>
            Você continua conectado. Aguarde alguns segundos e tente de novo.
          </AlertDescription>
        </Alert>
        <Button
          onClick={() => {
            setStatus("loading");
            void refreshSession();
          }}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col" aria-busy="true">
      <span className="sr-only" role="status">
        Carregando sua sessão
      </span>
      <div className="border-border bg-card flex h-15 items-center justify-between border-b px-5 sm:px-10">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="size-9 rounded-full" />
      </div>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-10 sm:px-10 sm:py-14">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    </div>
  );
}
