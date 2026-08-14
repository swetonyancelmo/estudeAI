"use client";

import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuthStore } from "@/lib/auth/store";
import { logout } from "@/lib/auth/actions";

/**
 * Barra fixa das rotas autenticadas (dashboard e wizard). Mantém a identidade
 * presente dentro do produto e dá um ponto de saída consistente.
 */
export function AppNav() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="border-border bg-card flex items-center justify-between border-b px-6 py-3.5 sm:px-7">
      <Wordmark href="/dashboard" className="text-[15px]" />
      <div className="flex items-center gap-4 text-sm">
        {user?.email && (
          <span className="text-muted-foreground hidden font-mono text-xs sm:inline">
            {user.email}
          </span>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="text-muted-foreground hover:text-foreground rounded-sm font-medium"
        >
          Sair
        </button>
        <ThemeToggle className="-mr-1" />
      </div>
    </header>
  );
}
