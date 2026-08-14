import {
  BadGatewayException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { RoadmapResponseDto, WizardAnswers } from '@estudeai/shared-types';

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
  weeklyTime: '15h',
  affinity: 'visual',
  learningStyle: 'pratico',
};

/** Roadmap válido de exemplo — order propositalmente "bagunçado" para provar a reindexação. */
function validRoadmapJson(): string {
  const roadmap: RoadmapResponseDto = {
    targetArea: 'frontend',
    justification: 'Perfil visual, foco no mercado, 15h por semana, estilo prático.',
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

function buildService(env: Record<string, string | undefined>): RoadmapAiService {
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;
  return new RoadmapAiService(config);
}

describe('RoadmapAiService (Gemini mockado — Etapa 4)', () => {
  const baseEnv = {
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-flash-latest',
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
