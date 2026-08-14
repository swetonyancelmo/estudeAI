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
      description="Comece a montar seu roadmap de estudos personalizado."
      submitLabel="Criar conta"
      resolver={zodResolver(registerSchema)}
      onSubmit={register}
      passwordHint="Mínimo de 8 caracteres."
      footer={
        <>
          Já tem conta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    />
  );
}
