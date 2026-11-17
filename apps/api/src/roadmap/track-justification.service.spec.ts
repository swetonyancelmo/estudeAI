import type { ConfigService } from '@nestjs/config';
import type { WizardAnswers } from '@estudeai/shared-types';

const generateContent = jest.fn();
jest.mock('@google/genai', () => ({
  ...jest.requireActual('@google/genai'),
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent },
  })),
}));

import { TrackJustificationService } from './track-justification.service';
import {
  buildJustificationPrompt,
  buildRuleJustification,
  sanitizeJustification,
  type JustificationFacts,
} from './track-justification';

const answers: WizardAnswers = {
  goal: 'mercado',
  area: 'nao-sei',
  affinity: 'visual',
  knownSkills: ['git', 'html-css'],
  weeklyTime: '15h',
  learningStyle: 'audiovisual',
};

const facts: JustificationFacts = {
  area: 'frontend',
  areaChosenByUser: false,
  moduleCount: 9,
  topicCount: 44,
  knownTopicCount: 11,
};

const GOOD_TEXT =
  'A trilha de Frontend combina com o seu objetivo de entrar no mercado e com o tempo que você tem por semana para estudar.';

function buildService(env: Record<string, string | undefined> = {}) {
  const values: Record<string, string | undefined> = {
    GEMINI_API_KEY: 'key',
    GEMINI_MODELS: 'modelo-a,modelo-b',
    ...env,
  };
  const config = {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
  return new TrackJustificationService(config);
}

describe('buildRuleJustification', () => {
  it('cita afinidade, objetivo, tempo, tamanho e o que já começa concluído', () => {
    const text = buildRuleJustification(answers, facts);

    expect(text).toContain('interface e experiência visual');
    expect(text).toContain('entrar no mercado');
    expect(text).toContain('Frontend');
    expect(text).toContain('cerca de 15 horas por semana');
    expect(text).toContain('44 tópicos em 9 módulos');
    expect(text).toContain('11 tópicos já começam concluídos');
    expect(text).toContain('vídeo');
  });

  it('quem escolheu a área não ouve que foi a afinidade que decidiu', () => {
    const text = buildRuleJustification(
      { ...answers, area: 'devops', affinity: undefined, knownSkills: [] },
      { ...facts, area: 'devops', areaChosenByUser: true, knownTopicCount: 0 },
    );

    expect(text).toContain('Você escolheu a trilha de DevOps');
    expect(text).not.toContain('afinidade');
    expect(text).not.toContain('concluíd');
  });

  it('concorda no singular', () => {
    const text = buildRuleJustification(answers, {
      ...facts,
      moduleCount: 1,
      topicCount: 1,
      knownTopicCount: 1,
    });

    expect(text).toContain('1 tópico em 1 módulo.');
    expect(text).toContain('1 tópico já começa concluído');
  });
});

describe('buildJustificationPrompt', () => {
  it('leva os fatos por extenso, com as habilidades pelo nome', () => {
    const prompt = buildJustificationPrompt(answers, facts);

    expect(prompt).toContain('Trilha: Frontend');
    expect(prompt).toContain('Git, HTML e CSS');
    expect(prompt).toContain('44 tópicos em 9 módulos');
  });
});

describe('sanitizeJustification', () => {
  it.each([
    ['vazio', ''],
    ['ausente', undefined],
    ['curto demais', 'Boa escolha!'],
    ['longo demais', 'a'.repeat(701)],
    ['com markdown', `**Ótima escolha!** ${GOOD_TEXT}`],
    ['em lista', `- ${GOOD_TEXT}`],
  ])('recusa texto %s', (_label, raw) => {
    expect(sanitizeJustification(raw)).toBeNull();
  });

  it('aceita texto corrido e normaliza espaços e quebras', () => {
    expect(sanitizeJustification(`  ${GOOD_TEXT}\n\n`)).toBe(GOOD_TEXT);
  });
});

describe('TrackJustificationService', () => {
  const fallback = buildRuleJustification(answers, facts);

  beforeEach(() => jest.clearAllMocks());

  it('devolve o texto do Gemini quando ele vem no formato pedido', async () => {
    generateContent.mockResolvedValue({ text: GOOD_TEXT });

    expect(await buildService().write(answers, facts)).toBe(GOOD_TEXT);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('sem GEMINI_API_KEY usa o texto por regra e nem chama a IA', async () => {
    const service = buildService({ GEMINI_API_KEY: undefined });

    expect(await service.write(answers, facts)).toBe(fallback);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('resposta fora do formato cai no texto por regra', async () => {
    generateContent.mockResolvedValue({ text: '# Título\n- item' });

    expect(await buildService().write(answers, facts)).toBe(fallback);
  });

  it('falha transitória tenta o próximo modelo', async () => {
    generateContent
      .mockRejectedValueOnce(
        Object.assign(new Error('overloaded'), { status: 503 }),
      )
      .mockResolvedValueOnce({ text: GOOD_TEXT });

    expect(await buildService().write(answers, facts)).toBe(GOOD_TEXT);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('erro fatal (key inválida) não percorre a cadeia e não lança', async () => {
    generateContent.mockRejectedValue(
      Object.assign(new Error('invalid key'), { status: 401 }),
    );

    expect(await buildService().write(answers, facts)).toBe(fallback);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('modelo que trava gasta só a sua fatia do tempo, e o reserva responde', async () => {
    generateContent
      .mockImplementationOnce(
        ({ config }: { config: { abortSignal: AbortSignal } }) =>
          new Promise((_resolve, reject) => {
            config.abortSignal.addEventListener('abort', () =>
              reject(new Error('This operation was aborted')),
            );
          }),
      )
      .mockResolvedValueOnce({ text: GOOD_TEXT });

    const service = buildService({ JUSTIFICATION_TIMEOUT_MS: '60' });

    expect(await service.write(answers, facts)).toBe(GOOD_TEXT);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it('todos os modelos falhando ainda devolve uma justificativa', async () => {
    generateContent.mockRejectedValue(new Error('rede'));

    expect(await buildService().write(answers, facts)).toBe(fallback);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
