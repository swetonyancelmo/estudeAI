"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/auth/store";
import { refreshSession } from "@/lib/api/client";

/**
 * Provider raiz do client. No mount, tenta hidratar a sessão via /auth/refresh
 * (o access token vive só em memória, então some a cada reload e é re-obtido aqui
 * usando o cookie httpOnly). Também provê o QueryClient do TanStack Query.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const setStatus = useAuthStore((s) => s.setStatus);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    setStatus("loading");
    // refreshSession já atualiza o store (authenticated/unauthenticated).
    void refreshSession();
  }, [setStatus]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
