"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <form onSubmit={submit} noValidate>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete={submitLabel === "Entrar" ? "current-password" : "new-password"}
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            ) : (
              passwordHint && (
                <p className="text-muted-foreground text-xs">{passwordHint}</p>
              )
            )}
          </div>

          {formError && (
            <p className="text-destructive text-sm" role="alert">
              {formError}
            </p>
          )}
        </CardContent>

        <CardFooter className="mt-2 flex flex-col gap-3">
          <Button
            type="submit"
            className="h-10 w-full rounded-md font-semibold"
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
          <div className="text-muted-foreground text-center text-sm">{footer}</div>
        </CardFooter>
      </form>
    </Card>
  );
}
