"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthForm } from "@/components/auth/auth-form";
import { loginSchema } from "@/lib/auth/schemas";
import { login } from "@/lib/auth/actions";

export default function LoginPage() {
  return (
    <AuthForm
      title="Entrar"
      description="Sua rota está onde você deixou."
      submitLabel="Entrar"
      pendingLabel="Entrando…"
      resolver={zodResolver(loginSchema)}
      onSubmit={login}
      footer={
        <>
          Não tem conta?{" "}
          <Link href="/register" className="text-brand-ink font-semibold underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </>
      }
    />
  );
}
