"use client";

import { useEffect, useState } from "react";
import type { HealthStatusDto } from "@estudeai/shared-types";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

type FetchState =
  | { kind: "loading" }
  | { kind: "success"; data: HealthStatusDto }
  | { kind: "error"; message: string };

export function HealthStatus() {
  const [state, setState] = useState<FetchState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${API_URL}/health`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as HealthStatusDto;
        setState({ kind: "success", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        setState({ kind: "error", message });
      });

    return () => controller.abort();
  }, []);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Status da API</CardTitle>
        <CardDescription>{API_URL}/health</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {state.kind === "loading" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Verificando conexão...</span>
          </div>
        )}

        {state.kind === "success" && (
          <>
            <div className="flex items-center gap-2">
              {state.data.status === "ok" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>API: </span>
              <Badge variant={state.data.status === "ok" ? "default" : "destructive"}>
                {state.data.status}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {state.data.database === "up" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span>Banco de dados: </span>
              <Badge variant={state.data.database === "up" ? "default" : "destructive"}>
                {state.data.database}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Última verificação: {new Date(state.data.timestamp).toLocaleString("pt-BR")}
            </p>
          </>
        )}

        {state.kind === "error" && (
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="h-4 w-4" />
            <span>Falha ao conectar na API: {state.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
