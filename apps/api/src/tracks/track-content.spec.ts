import {
  InvalidTrackContentError,
  MAX_TOPIC_DOCS,
  TRACK_SLUGS,
  isOfficialDocUrl,
  loadTrack,
  validateTrackContent,
  type TrackContent,
} from './track-content';

function topic(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    slug,
    title: `Tópico ${slug}`,
    level: 'iniciante',
    required: true,
    estimatedHours: 3,
    knownSkill: null,
    prerequisites: [],
    searchQuery: `${slug} tutorial`,
    ...overrides,
  };
}

function track(topics: unknown[], extraModules: unknown[] = []): unknown {
  return {
    slug: 'frontend',
    title: 'Frontend',
    description: 'Trilha de teste.',
    modules: [
      {
        slug: 'modulo-a',
        title: 'Módulo A',
        description: 'Primeiro módulo.',
        topics,
        project: {
          title: 'Projeto',
          description: 'Construa.',
          estimatedHours: 8,
        },
      },
      ...extraModules,
    ],
  };
}

function problemsOf(raw: unknown): string[] {
  try {
    validateTrackContent(raw, 'frontend');
  } catch (error) {
    if (error instanceof InvalidTrackContentError) {
      return error.problems;
    }
    throw error;
  }
  return [];
}

describe('conteúdo real das trilhas (src/tracks/content)', () => {
  // É este teste que impede um JSON quebrado de chegar ao boot da API.
  it.each(TRACK_SLUGS)('%s.json é válido', (slug) => {
    const { content, hash } = loadTrack(slug);

    expect(content.slug).toBe(slug);
    expect(content.modules.length).toBeGreaterThan(0);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(TRACK_SLUGS)(
    '%s: os obrigatórios sozinhos cobrem todos os módulos',
    (slug) => {
      const { content } = loadTrack(slug);

      // Quem tem 5h/semana recebe só os obrigatórios (docs/TRILHAS.md §5): um
      // módulo sem nenhum deles sumiria inteiro do roadmap dessa pessoa.
      for (const module of content.modules) {
        expect(module.topics.some((item) => item.required)).toBe(true);
      }
    },
  );
});

describe('validateTrackContent', () => {
  it('aceita uma trilha íntegra e a devolve tipada', () => {
    const content: TrackContent = validateTrackContent(
      track([topic('a'), topic('b', { prerequisites: ['a'] })]),
      'frontend',
    );

    expect(content.modules[0].topics).toHaveLength(2);
  });

  it('recusa slug que não bate com o nome do arquivo', () => {
    expect(() => validateTrackContent(track([topic('a')]), 'backend')).toThrow(
      InvalidTrackContentError,
    );
  });

  it('recusa slug de tópico repetido, mesmo em módulos diferentes', () => {
    const problems = problemsOf(
      track(
        [topic('a')],
        [
          {
            slug: 'modulo-b',
            title: 'Módulo B',
            description: 'Segundo.',
            topics: [topic('a')],
            project: { title: 'P', description: 'D', estimatedHours: 4 },
          },
        ],
      ),
    );

    expect(problems).toEqual([expect.stringContaining('slug duplicado')]);
  });

  it('recusa pré-requisito inexistente ou que vem depois', () => {
    const problems = problemsOf(
      track([topic('a', { prerequisites: ['b'] }), topic('b')]),
    );

    expect(problems).toEqual([
      expect.stringContaining('não existe ou vem depois'),
    ]);
  });

  it('recusa obrigatório que depende de opcional', () => {
    const problems = problemsOf(
      track([
        topic('a', { required: false }),
        topic('b', { prerequisites: ['a'] }),
      ]),
    );

    expect(problems).toEqual([
      expect.stringContaining('depende do opcional "a"'),
    ]);
  });

  it('recusa level e knownSkill fora do vocabulário', () => {
    const problems = problemsOf(
      track([topic('a', { level: 'expert', knownSkill: 'cobol' })]),
    );

    expect(problems).toHaveLength(2);
  });

  it('lista todos os problemas de uma vez, não só o primeiro', () => {
    const problems = problemsOf(
      track([
        topic('a', { estimatedHours: 0 }),
        topic('b', { searchQuery: '' }),
        topic('c', { required: 'sim' }),
      ]),
    );

    expect(problems).toHaveLength(3);
  });
});

describe('docs — documentação oficial por tópico (Fase 2)', () => {
  const mdn = {
    title: 'Visão geral do HTTP',
    url: 'https://developer.mozilla.org/pt-BR/docs/Web/HTTP/Guides/Overview',
  };

  it('aceita links oficiais e tópico sem docs', () => {
    expect(
      problemsOf(
        track([
          topic('a', {
            docs: [mdn, { title: 'React', url: 'https://react.dev/learn' }],
          }),
          topic('b'),
        ]),
      ),
    ).toEqual([]);
  });

  it('recusa domínio que não é oficial, http e lista grande demais', () => {
    const many = Array.from({ length: MAX_TOPIC_DOCS + 1 }, (_, index) => ({
      title: `Doc ${index}`,
      url: `https://developer.mozilla.org/en-US/docs/Web/${index}`,
    }));
    const problems = problemsOf(
      track([
        topic('a', {
          docs: [
            { title: 'Blog', url: 'https://medium.com/algum-post' },
            { title: 'Sem TLS', url: 'http://react.dev/learn' },
          ],
        }),
        topic('b', { docs: many }),
        topic('c', { docs: [mdn, mdn] }),
        topic('d', { docs: 'https://react.dev' }),
      ]),
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining('"https://medium.com/algum-post" não é https'),
        expect.stringContaining('"http://react.dev/learn" não é https'),
        expect.stringContaining(`no máximo ${MAX_TOPIC_DOCS} links`),
        expect.stringContaining('doc repetido'),
        expect.stringContaining('docs deve ser uma lista'),
      ]),
    );
  });

  it.each([
    ['https://docs.aws.amazon.com/ec2/', true],
    ['https://www.postgresql.org/docs/current/', true],
    ['https://developer.mozilla.org.evil.com/x', false],
    ['https://evilreact.dev/learn', false],
    ['https://user:pw@react.dev/learn', false],
    ['javascript:alert(1)', false],
  ])('isOfficialDocUrl(%s) = %s', (url, expected) => {
    expect(isOfficialDocUrl(url)).toBe(expected);
  });
});
