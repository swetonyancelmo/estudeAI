"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "@base-ui/react/menu";
import { LogOut } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth/store";
import { logout } from "@/lib/auth/actions";

/**
 * Barra das rotas autenticadas. A conta fica num avatar com a inicial: o
 * e-mail completo só aparece dentro do menu, em vez de ocupar o topo de todas
 * as telas.
 */
export function AppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";
  const onRoadmaps =
    pathname === "/dashboard" || pathname.startsWith("/roadmaps");

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <header className="border-border bg-card flex items-center justify-between border-b px-5 py-2 sm:px-10">
      <div className="flex items-center gap-6">
        <Wordmark href="/dashboard" />
        <Link
          href="/dashboard"
          aria-current={onRoadmaps ? "page" : undefined}
          className={cn(
            "hidden min-h-11 items-center rounded-md text-sm font-semibold transition-colors sm:flex",
            onRoadmaps
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Meus roadmaps
        </Link>
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Menu.Root>
          <Menu.Trigger
            aria-label="Conta"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <span className="bg-foreground text-background font-heading flex size-9 items-center justify-center rounded-full text-base font-bold">
              {initial}
            </span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner align="end" sideOffset={6} className="z-50">
              <Menu.Popup className="border-border bg-popover text-popover-foreground min-w-56 rounded-lg border p-1.5 shadow-[0_3px_0_var(--border)] outline-none">
                {user?.email && (
                  <p className="data-label text-ink-faint truncate px-3 py-2">
                    {user.email}
                  </p>
                )}
                <Menu.LinkItem
                  render={<Link href="/dashboard" />}
                  className="data-[highlighted]:bg-muted flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm font-medium outline-none sm:hidden"
                >
                  Meus roadmaps
                </Menu.LinkItem>
                <Menu.Item
                  onClick={handleLogout}
                  className="data-[highlighted]:bg-muted flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium outline-none"
                >
                  <LogOut className="size-4" />
                  Sair
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  );
}
