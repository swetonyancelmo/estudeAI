"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractApiError } from "@/lib/auth/actions";

export interface AuthFormValues {
  email: string;
  password: string;
}

interface AuthFormProps {
  title: string;
  description: string;
  submitLabel: string;
  resolver: Resolver<AuthFormValues>;
  onSubmit: (values: AuthFormValues) => Promise<void>;
  passwordHint?: string;
  footer: React.ReactNode;
}

export function AuthForm({
  title,
  description,
  submitLabel,
  resolver,
  onSubmit,
  passwordHint,
  footer,
}: AuthFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AuthFormValues>({ resolver });

  const submit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await onSubmit(values);
      router.replace("/dashboard");
    } catch (error) {
      setFormError(extractApiError(error, "Não foi possível concluir. Tente novamente."));
    }
  });

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1>{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...register("email")}
          />
          {errors.email && (
            <p id="email-error" className="text-destructive text-sm">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            autoComplete={passwordHint ? "new-password" : "current-password"}
            aria-invalid={!!errors.password}
            aria-describedby="password-help"
            {...register("password")}
          />
          {errors.password ? (
            <p id="password-help" className="text-destructive text-sm">
              {errors.password.message}
            </p>
          ) : (
            passwordHint && (
              <p id="password-help" className="text-ink-faint text-sm">
                {passwordHint}
              </p>
            )
          )}
        </div>

        {formError && (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        )}

        <Button type="submit" className="mt-1 w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </form>

      <p className="text-muted-foreground text-sm">{footer}</p>
    </div>
  );
}
