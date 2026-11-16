import type { ConfigService } from '@nestjs/config';
import {
  DEFAULT_GEMINI_MODELS,
  classifyGeminiError,
  resolveGeminiModels,
} from './gemini-models';

function config(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describe('resolveGeminiModels', () => {
  it('usa GEMINI_MODELS, limpando espaços, vazios e duplicatas', () => {
    expect(
      resolveGeminiModels(config({ GEMINI_MODELS: ' a , b,,a, c ' })),
    ).toEqual(['a', 'b', 'c']);
  });

  it('cai no GEMINI_MODEL legado quando GEMINI_MODELS não existe', () => {
    expect(resolveGeminiModels(config({ GEMINI_MODEL: 'legado' }))).toEqual([
      'legado',
    ]);
  });

  it('usa o default quando nada está configurado', () => {
    expect(resolveGeminiModels(config({ GEMINI_MODELS: ' ' }))).toEqual([
      ...DEFAULT_GEMINI_MODELS,
    ]);
  });
});

describe('classifyGeminiError', () => {
  const withStatus = (status: number) =>
    Object.assign(new Error('x'), { status });

  it.each([429, 500, 502, 503, 504])('%i → retry', (status) => {
    expect(classifyGeminiError(withStatus(status))).toBe('retry');
  });

  it('404 → next-model', () => {
    expect(classifyGeminiError(withStatus(404))).toBe('next-model');
  });

  it.each([400, 401, 403])('%i → fatal', (status) => {
    expect(classifyGeminiError(withStatus(status))).toBe('fatal');
  });

  it('erro sem status (rede) → retry', () => {
    expect(classifyGeminiError(new Error('socket hang up'))).toBe('retry');
  });
});
