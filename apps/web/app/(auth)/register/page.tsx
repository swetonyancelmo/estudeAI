"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthForm } from "@/components/auth/auth-form";
import { registerSchema } from "@/lib/auth/schemas";
import { register } from "@/lib/auth/actions";

export default function RegisterPage() {
  return (
    <AuthForm
      title="Criar conta"
      description="Leva um minuto. Depois são 4 perguntas até o seu roadmap."
      submitLabel="Criar conta"
      resolver={zodResolver(registerSchema)}
      onSubmit={register}
      passwordHint="Mínimo de 8 caracteres."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="text-brand-ink font-semibold underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    />
  );
}
