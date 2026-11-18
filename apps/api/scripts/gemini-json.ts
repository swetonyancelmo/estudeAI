import type { GoogleGenAI, Schema } from '@google/genai';

/**
 * Chamada ao Gemini com resposta JSON estruturada, para os scripts de
 * curadoria (docs, quizzes). Ordem de modelos de `GEMINI_MODELS`; modelo que
 * responde 429 (cota) é pulado pelo resto da execução; sobrecarga (503) e
 * falha de rede ganham novas tentativas com espera crescente; cada chamada tem
 * teto de tempo.
 */
const GEMINI_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 5;
const exhaustedModels = new Set<string>();

export function geminiModels(): string[] {
  const raw = process.env.GEMINI_MODELS ?? process.env.GEMINI_MODEL ?? '';
  const list = raw
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean);
  return list.length > 0
    ? list
    : ['gemini-flash-latest', 'gemini-flash-lite-latest'];
}

function isQuotaError(error: unknown): boolean {
  return /"code":\s*429|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(
    String(error),
  );
}

export async function generateJson<T>(
  ai: GoogleGenAI,
  request: {
    systemInstruction: string;
    prompt: string;
    schema: Schema;
    temperature?: number;
  },
): Promise<T> {
  let lastError: unknown;
  for (const model of geminiModels()) {
    if (exhaustedModels.has(model)) continue;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: request.prompt,
            config: {
              systemInstruction: request.systemInstruction,
              temperature: request.temperature ?? 0.2,
              responseMimeType: 'application/json',
              responseSchema: request.schema,
            },
          }),
          GEMINI_TIMEOUT_MS,
        );
        return JSON.parse(response.text ?? '{}') as T;
      } catch (error) {
        lastError = error;
        console.log(
          `  … ${model}, tentativa ${attempt + 1}: ${String(error).slice(0, 120)}`,
        );
        if (isQuotaError(error)) {
          // Cota não volta em segundos: insistir só gasta tempo.
          exhaustedModels.add(model);
          console.log(`  … ${model} sem cota, pulado pelo resto da rodada.`);
          break;
        }
        // Sobrecarga (503) costuma passar em alguns segundos.
        await sleep(Math.min(5_000 * 2 ** attempt, 60_000));
      }
    }
  }
  throw lastError;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`sem resposta em ${ms} ms`)),
        ms,
      );
    }),
  ]).finally(() => clearTimeout(timer));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
