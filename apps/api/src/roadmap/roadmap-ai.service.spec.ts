import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type {
  AdjustedRoadmapDto,
  RoadmapDetailDto,
  RoadmapResponseDto,
  WizardAnswers,
} from '@estudeai/shared-types';

// Mock do SDK: o construtor GoogleGenAI passa a devolver um objeto cujo
// models.generateContent controlamos por teste. Nada bate na API real.
const generateContent = jest.fn();
jest.mock('@google/genai', () => ({
  ...jest.requireActual('@google/genai'),
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}));

import { GoogleGenAI } from '@google/genai';
import { RoadmapAiService } from './roadmap-ai.service';

const answers: WizardAnswers = {
  goal: 'mercado',
  area: 'nao-sei',
  knownSkills: [],
  weeklyTime: '15h',
  affinity: 'visual',
  learningStyle: 'pratico',
};

/** Roadmap válido de exemplo — order propositalmente "bagunçado" para provar a reindexação. */
function validRoadmapJson(): string {
  const roadmap: RoadmapResponseDto = {
    targetArea: 'frontend',
    justification:
      'Perfil visual, foco no mercado, 15h por semana, estilo prático.',
    modules: [
      {
        title: 'Fundamentos da Web',
        description: 'A base do frontend.',
        order: 5,
        topics: [
          { title: 'HTML semântico', order: 9 },
          { title: 'CSS moderno', order: 3, estimatedHours: 4 },
        ],
      },
      {
        title: 'JavaScript',
        description: 'Interatividade no cliente.',
        order: 2,
        topics: [{ title: 'DOM e eventos', order: 7 }],
      },
    ],
  };
  return JSON.stringify(roadmap);
}

function buildService(
  env: Record<string, string | undefined>,
): RoadmapAiService {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  return new RoadmapAiService(config);
}

describe('RoadmapAiService (Gemini mockado — Etapa 4)', () => {
  const baseEnv = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-flash-latest',
    GEMINI_RETRY_BASE_MS: '0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('parseia a resposta e devolve um RoadmapResponseDto válido', async () => {
    generateContent.mockResolvedValue({ text: validRoadmapJson() });
    const service = buildService(baseEnv);

    const roadmap = await service.generate(answers);

    expect(roadmap.targetArea).toBe('frontend');
    expect(roadmap.justification.length).toBeGreaterThan(0);
    expect(roadmap.modules.length).toBe(2);
  });

  it('passa systemInstruction, responseSchema e o modelo configurado ao SDK', async () => {
    generateContent.mockResolvedValue({ text: validRoadmapJson() });
    const service = buildService(baseEnv);

    await service.generate(answers);

    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
    const call = generateContent.mock.calls[0][0];
    expect(call.model).toBe('gemini-flash-latest');
    expect(call.config.responseMimeType).toBe('application/json');
    expect(call.config.systemInstruction).toEqual(expect.any(String));
    expect(call.config.responseSchema).toBeDefined();
  });

  it('reindexa order de módulos e tópicos sequencialmente (0-based)', async () => {
    generateContent.mockResolvedValue({ text: validRoadmapJson() });
    const service = buildService(baseEnv);

    const roadmap = await service.generate(answers);

    roadmap.modules.forEach((module, moduleIndex) => {
      expect(module.order).toBe(moduleIndex);
      module.topics.forEach((topic, topicIndex) => {
        expect(topic.order).toBe(topicIndex);
      });
    });
  });

  it('502 (BadGateway) quando o Gemini retorna JSON malformado', async () => {
    generateContent.mockResolvedValue({ text: '{ isto não é json' });
    const service = buildService(baseEnv);

    await expect(service.generate(answers)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('502 (BadGateway) quando o JSON é válido mas foge do contrato', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        targetArea: 'mobile', // fora de TARGET_AREAS
        justification: 'x',
        modules: [],
      }),
    });
    const service = buildService(baseEnv);

    await expect(service.generate(answers)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('502 (BadGateway) quando a resposta vem vazia', async () => {
    generateContent.mockResolvedValue({ text: undefined });
    const service = buildService(baseEnv);

    await expect(service.generate(answers)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('503 (ServiceUnavailable) quando o SDK rejeita (rede/erro genérico)', async () => {
    generateContent.mockRejectedValue(new Error('network down'));
    const service = buildService(baseEnv);

    await expect(service.generate(answers)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('503 (ServiceUnavailable) quando o SDK rejeita por API key inválida', async () => {
    generateContent.mockRejectedValue(new Error('API key not valid'));
    const service = buildService(baseEnv);

    await expect(service.generate(answers)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('503 (ServiceUnavailable) quando GEMINI_API_KEY está ausente', async () => {
    const service = buildService({ GEMINI_API_KEY: undefined });

    await expect(service.generate(answers)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('504 (GatewayTimeout) quando a chamada estoura o GEMINI_TIMEOUT_MS', async () => {
    jest.useFakeTimers();
    // Promessa que nunca resolve → força o race a cair no timer.
    generateContent.mockReturnValue(new Promise(() => {}));
    const service = buildService({ ...baseEnv, GEMINI_TIMEOUT_MS: '20000' });

    const pending = service.generate(answers);
    // Silencia a rejeição até avançarmos o timer (evita unhandled rejection).
    const assertion = expect(pending).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    await jest.advanceTimersByTimeAsync(20000);
    await assertion;
  });
});

/** Simula o `ApiError` do SDK (só o `status` importa para a classificação). */
function apiError(status: number, message = `HTTP ${status}`): Error {
  return Object.assign(new Error(message), { status });
}

describe('RoadmapAiService — retry e fallback de modelos', () => {
  const env = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODELS: 'modelo-a, modelo-b',
    GEMINI_MAX_RETRIES: '1',
    GEMINI_RETRY_BASE_MS: '0',
  };
  const modelsCalled = () =>
    generateContent.mock.calls.map(([req]) => (req as { model: string }).model);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('repete o mesmo modelo após um 503 transitório e devolve o resultado', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce({ text: validRoadmapJson() });

    const roadmap = await buildService(env).generate(answers);

    expect(roadmap.targetArea).toBe('frontend');
    expect(modelsCalled()).toEqual(['modelo-a', 'modelo-a']);
  });

  it('esgotados os retries por 503, passa ao próximo modelo', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(503))
      .mockRejectedValueOnce(apiError(429))
      .mockResolvedValueOnce({ text: validRoadmapJson() });

    await buildService(env).generate(answers);

    expect(modelsCalled()).toEqual(['modelo-a', 'modelo-a', 'modelo-b']);
  });

  it('em 404 (modelo aposentado) pula direto ao próximo, sem retry', async () => {
    generateContent
      .mockRejectedValueOnce(apiError(404))
      .mockResolvedValueOnce({ text: validRoadmapJson() });

    await buildService(env).generate(answers);

    expect(modelsCalled()).toEqual(['modelo-a', 'modelo-b']);
  });

  it('erro fatal (ex.: 403 de key inválida) aborta a cadeia → 503', async () => {
    generateContent.mockRejectedValue(apiError(403));

    await expect(buildService(env).generate(answers)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(modelsCalled()).toEqual(['modelo-a']);
  });

  it('todos os modelos falhando → 503 após percorrer a cadeia inteira', async () => {
    generateContent.mockRejectedValue(apiError(503));

    await expect(buildService(env).generate(answers)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(modelsCalled()).toEqual([
      'modelo-a',
      'modelo-a',
      'modelo-b',
      'modelo-b',
    ]);
  });

  it('o backoff respeita o orçamento total: estourou o timeout → 504', async () => {
    jest.useFakeTimers();
    generateContent.mockRejectedValue(apiError(503));
    const service = buildService({
      ...env,
      GEMINI_RETRY_BASE_MS: '60000',
      GEMINI_TIMEOUT_MS: '1000',
    });

    const assertion = expect(service.generate(answers)).rejects.toBeInstanceOf(
      GatewayTimeoutException,
    );
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(modelsCalled()).toEqual(['modelo-a']);
  });
});

/** Detalhe persistido mínimo para alimentar o reajuste. */
function persistedRoadmap(): RoadmapDetailDto {
  return {
    weeklyHours: null,
    id: 'roadmap-1',
    targetArea: 'frontend',
    justification: 'justificativa',
    status: 'active',
    createdAt: '2026-01-01T12:00:00.000Z',
    progress: { completedTopics: 1, totalTopics: 2, percent: 50 },
    modules: [
      {
        id: 'm-1',
        title: 'Fundamentos',
        description: 'HTML e CSS',
        order: 0,
        topics: [
          {
            id: 't-1',
            kind: 'topic',
            title: 'HTML semântico',
            order: 0,
            isCompleted: true,
            estimatedHours: 4,
            resources: [],
          },
          {
            id: 't-2',
            kind: 'topic',
            title: 'CSS layout',
            order: 1,
            isCompleted: false,
            resources: [],
          },
        ],
      },
    ],
  };
}

function validAdjustmentJson(): string {
  const adjusted: AdjustedRoadmapDto = {
    adjustmentSummary: 'Enxuguei o pendente; o concluído continua lá.',
    modules: [
      {
        id: 'm-1',
        title: 'Fundamentos',
        description: 'HTML e CSS',
        topics: [
          {
            id: 't-1',
            title: 'HTML semântico',
            isCompleted: true,
            estimatedHours: 4,
          },
          { title: 'CSS essencial', isCompleted: false },
        ],
      },
    ],
  };
  return JSON.stringify(adjusted);
}

describe('RoadmapAiService.adjustRoadmap (Etapa 7)', () => {
  const baseEnv = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-flash-latest',
    GEMINI_RETRY_BASE_MS: '0',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('usa system instruction e schema PRÓPRIOS, diferentes dos da geração', async () => {
    generateContent.mockResolvedValue({ text: validAdjustmentJson() });
    const service = buildService(baseEnv);

    await service.adjustRoadmap(persistedRoadmap(), 'tenho menos tempo');
    const adjustCall = generateContent.mock.calls[0][0];

    generateContent.mockResolvedValue({ text: validRoadmapJson() });
    await service.generate(answers);
    const generateCall = generateContent.mock.calls[1][0];

    expect(adjustCall.config.systemInstruction).not.toBe(
      generateCall.config.systemInstruction,
    );
    expect(adjustCall.config.responseSchema).not.toBe(
      generateCall.config.responseSchema,
    );
    // A área não entra no schema do reajuste — a IA não tem como trocá-la.
    expect(Object.keys(adjustCall.config.responseSchema.properties)).toEqual([
      'adjustmentSummary',
      'modules',
    ]);
  });

  it('preserva o id ausente como "tópico novo" ao normalizar', async () => {
    generateContent.mockResolvedValue({ text: validAdjustmentJson() });
    const service = buildService(baseEnv);

    const adjusted = await service.adjustRoadmap(
      persistedRoadmap(),
      'tenho menos tempo',
    );

    expect(adjusted.modules[0].topics[0].id).toBe('t-1');
    expect(adjusted.modules[0].topics[1].id).toBeUndefined();
  });

  it('502 (BadGateway) quando a resposta do reajuste foge do contrato', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({ adjustmentSummary: 'ok', modules: [] }),
    });
    const service = buildService(baseEnv);

    await expect(
      service.adjustRoadmap(persistedRoadmap(), 'tenho menos tempo'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('502 (BadGateway) quando o reajuste vem com JSON malformado', async () => {
    generateContent.mockResolvedValue({ text: '{ nope' });
    const service = buildService(baseEnv);

    await expect(
      service.adjustRoadmap(persistedRoadmap(), 'tenho menos tempo'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
