"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth/store";
import { logout } from "@/lib/auth/actions";

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-16">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Bem-vindo(a) de volta</CardTitle>
          <CardDescription>
            Faça o diagnóstico para gerar um roadmap de estudos personalizado.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm">
            Logado como <span className="font-medium">{user?.email}</span>
          </p>
          <Button onClick={() => router.push("/wizard")} className="w-fit">
            Montar meu roadmap
          </Button>
          <Button variant="outline" onClick={handleLogout} className="w-fit">
            Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
