import type { ConfigService } from '@nestjs/config';

/**
 * Cadeia de fallback padrão. Aliases `-latest` acompanham a versão atual e não
 * viram 404 quando uma versão fixa é aposentada; o `lite` costuma estar menos
 * congestionado quando o flash principal responde 503 por alta demanda.
 */
export const DEFAULT_GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
] as const;

/**
 * Lê a lista ordenada de modelos a tentar:
 * 1. `GEMINI_MODELS` (separada por vírgula) — preferida;
 * 2. `GEMINI_MODEL` (legado, um só modelo) — mantém configs antigas funcionando;
 * 3. `DEFAULT_GEMINI_MODELS`.
 * Remove vazios e duplicatas, preservando a ordem.
 */
export function resolveGeminiModels(config: ConfigService): string[] {
  const raw =
    config.get<string>('GEMINI_MODELS') ?? config.get<string>('GEMINI_MODEL');
  const models = (raw ?? '')
    .split(',')
    .map((model) => model.trim())
    .filter((model) => model.length > 0);
  const unique = [...new Set(models)];
  return unique.length > 0 ? unique : [...DEFAULT_GEMINI_MODELS];
}

/**
 * O que fazer depois de uma falha do Gemini:
 * - `retry`: falha transitória (sobrecarga/rate limit/5xx) → backoff e tenta de
 *   novo o MESMO modelo; esgotadas as tentativas, passa ao próximo.
 * - `next-model`: o modelo não existe/foi aposentado para esta conta (404) →
 *   repetir é inútil, vai direto ao próximo.
 * - `fatal`: erro que nenhum modelo resolve (key inválida, request malformado)
 *   → aborta a cadeia.
 */
export type GeminiFailureAction = 'retry' | 'next-model' | 'fatal';

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

export function classifyGeminiError(error: unknown): GeminiFailureAction {
  const status = extractStatus(error);
  if (status === 404) {
    return 'next-model';
  }
  if (status !== undefined && TRANSIENT_STATUSES.has(status)) {
    return 'retry';
  }
  if (status !== undefined) {
    return 'fatal';
  }
  // Sem status HTTP (falha de rede, socket resetado): trata como transitória.
  return 'retry';
}

/** `ApiError` do SDK expõe `status`; duck typing evita depender da classe. */
function extractStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const { status } = error;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}
