"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Conta"
            className="flex size-11 items-center justify-center rounded-full"
          >
            <Avatar className="size-9 after:hidden">
              <AvatarFallback className="bg-foreground text-background font-heading text-base font-bold">
                {initial}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={6} className="w-auto min-w-56">
            {user?.email && (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="truncate">
                  {user.email}
                </DropdownMenuLabel>
              </DropdownMenuGroup>
            )}
            <DropdownMenuLinkItem
              render={<Link href="/dashboard" />}
              className="sm:hidden"
            >
              Meus roadmaps
            </DropdownMenuLinkItem>
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
