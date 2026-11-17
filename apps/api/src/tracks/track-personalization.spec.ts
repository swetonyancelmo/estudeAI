import type { KnownSkill, WeeklyTime } from '@estudeai/shared-types';
import { TRACK_SLUGS, loadTrack } from './track-content';
import {
  personalizeTrack,
  type TrackTopicShape,
} from './track-personalization';

function topic(
  slug: string,
  overrides: Partial<TrackTopicShape> = {},
): TrackTopicShape {
  return {
    slug,
    level: 'iniciante',
    required: true,
    knownSkill: null,
    prerequisites: [],
    ...overrides,
  };
}

function slugsOf(
  modules: { topics: TrackTopicShape[] }[],
  weeklyTime: WeeklyTime,
  knownSkills: KnownSkill[] = [],
): string[][] {
  return personalizeTrack(modules, { weeklyTime, knownSkills }).map((module) =>
    module.topics.map((item) => item.topic.slug),
  );
}

describe('personalizeTrack', () => {
  const modules = [
    {
      topics: [
        topic('obrigatorio'),
        topic('opcional-basico', { required: false }),
        topic('opcional-inter', { required: false, level: 'intermediario' }),
        topic('opcional-avancado', { required: false, level: 'avancado' }),
      ],
    },
  ];

  it.each<[WeeklyTime, string[]]>([
    ['5h', ['obrigatorio']],
    ['15h', ['obrigatorio', 'opcional-basico', 'opcional-inter']],
    [
      '30h+',
      ['obrigatorio', 'opcional-basico', 'opcional-inter', 'opcional-avancado'],
    ],
  ])('%s define a profundidade', (weeklyTime, expected) => {
    expect(slugsOf(modules, weeklyTime)).toEqual([expected]);
  });

  it('obrigatório avançado entra mesmo com 5h', () => {
    const result = slugsOf(
      [{ topics: [topic('nucleo', { level: 'avancado' })] }],
      '5h',
    );

    expect(result).toEqual([['nucleo']]);
  });

  it('opcional cujo pré-requisito ficou de fora também fica', () => {
    const chained = [
      {
        topics: [
          topic('base', { required: false, level: 'avancado' }),
          // Intermediário caberia nas 15h, mas depende de um avançado cortado.
          topic('dependente', {
            required: false,
            level: 'intermediario',
            prerequisites: ['base'],
          }),
        ],
      },
      { topics: [topic('outro')] },
    ];

    expect(slugsOf(chained, '15h')).toEqual([['outro']]);
    expect(slugsOf(chained, '30h+')).toEqual([
      ['base', 'dependente'],
      ['outro'],
    ]);
  });

  it('omite o módulo que ficou sem tópicos e mantém a ordem dos demais', () => {
    const result = slugsOf(
      [
        { topics: [topic('a')] },
        { topics: [topic('so-opcional', { required: false })] },
        { topics: [topic('c')] },
      ],
      '5h',
    );

    expect(result).toEqual([['a'], ['c']]);
  });

  it('habilidade dominada não remove o tópico: marca como já sabido', () => {
    const result = personalizeTrack(
      [
        {
          topics: [
            topic('git-basico', { knownSkill: 'git' }),
            topic('sql-basico', { knownSkill: 'sql' }),
            topic('sem-atalho'),
          ],
        },
      ],
      { weeklyTime: '5h', knownSkills: ['git'] },
    );

    expect(
      result[0].topics.map((item) => [item.topic.slug, item.alreadyKnown]),
    ).toEqual([
      ['git-basico', true],
      ['sql-basico', false],
      ['sem-atalho', false],
    ]);
  });

  it('devolve os próprios objetos da trilha, sem copiar nem mutar', () => {
    const source = [{ id: 'm-1', topics: [topic('a')] }];
    const snapshot = structuredClone(source);

    const result = personalizeTrack(source, {
      weeklyTime: '5h',
      knownSkills: [],
    });

    expect(result[0].module).toBe(source[0]);
    expect(result[0].topics[0].topic).toBe(source[0].topics[0]);
    expect(source).toEqual(snapshot);
  });
});

describe('recorte sobre o conteúdo real', () => {
  const times: WeeklyTime[] = ['5h', '15h', '30h+'];

  it.each(TRACK_SLUGS)(
    '%s: mais tempo nunca dá um roadmap menor, e 30h+ é a trilha inteira',
    (slug) => {
      const { modules } = loadTrack(slug).content;
      const total = modules.flatMap((module) => module.topics).length;

      const sizes = times.map(
        (weeklyTime) =>
          personalizeTrack(modules, { weeklyTime, knownSkills: [] }).flatMap(
            (module) => module.topics,
          ).length,
      );

      expect(sizes[0]).toBeLessThan(sizes[1]);
      expect(sizes[1]).toBeLessThanOrEqual(sizes[2]);
      expect(sizes[2]).toBe(total);
    },
  );

  it.each(TRACK_SLUGS)('%s: nenhum módulo some, em nenhum ritmo', (slug) => {
    const { modules } = loadTrack(slug).content;

    for (const weeklyTime of times) {
      expect(
        personalizeTrack(modules, { weeklyTime, knownSkills: [] }),
      ).toHaveLength(modules.length);
    }
  });
});
