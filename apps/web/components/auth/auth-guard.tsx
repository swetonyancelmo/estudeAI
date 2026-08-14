"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth/store";

/**
 * Fonte da verdade da proteção de rota (funciona cross-domain, ao contrário do
 * proxy.ts otimista). Reage ao status da sessão:
 * - idle/loading: mostra spinner enquanto o bootstrap decide;
 * - unauthenticated: redireciona para /login;
 * - authenticated: renderiza o conteúdo protegido.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 items-center justify-center p-16">
      <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
    </div>
  );
}
