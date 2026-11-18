"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth/store";
import { refreshSession } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fonte da verdade da proteção de rota (funciona cross-domain, ao contrário do
 * proxy.ts otimista). Reage ao status da sessão:
 * - idle/loading: mostra spinner enquanto o bootstrap decide;
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-16 text-center" role="alert">
        <p className="flex items-center gap-2 font-medium">
          <AlertCircle className="size-4" />
          Não foi possível confirmar sua sessão agora.
        </p>
        <p className="text-muted-foreground max-w-sm text-sm">
          Você continua conectado. Aguarde alguns segundos e tente de novo.
        </p>
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
    <div className="flex flex-1 items-center justify-center p-16">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
    </div>
  );
}
