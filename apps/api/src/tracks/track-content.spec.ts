import {
  InvalidTrackContentError,
  MAX_QUIZ_QUESTIONS,
  MAX_TOPIC_CHALLENGES,
  MAX_TOPIC_DOCS,
  MAX_TOPIC_VIDEOS,
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

describe('videos — videoaulas do YouTube por tópico', () => {
  const video = (id: string) => ({
    title: `Aula ${id}`,
    url: `https://www.youtube.com/watch?v=${id}`,
    channel: 'Canal',
  });

  it('aceita vídeos na forma canônica, com ou sem canal, e tópico sem vídeos', () => {
    expect(
      problemsOf(
        track([
          topic('a', {
            videos: [
              video('dQw4w9WgXcQ'),
              {
                title: 'Outra',
                url: 'https://www.youtube.com/watch?v=abcdefghijk',
              },
            ],
          }),
          topic('b'),
        ]),
      ),
    ).toEqual([]);
  });

  it('recusa URL fora do formato canônico, repetida, lista grande e tipo errado', () => {
    const many = Array.from({ length: MAX_TOPIC_VIDEOS + 1 }, (_, index) =>
      video(`aaaaaaaaaa${index}`),
    );
    const problems = problemsOf(
      track([
        topic('a', {
          videos: [
            { title: 'Curto', url: 'https://youtu.be/dQw4w9WgXcQ' },
            {
              title: 'Com tempo',
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5',
            },
            {
              title: 'Playlist',
              url: 'https://www.youtube.com/playlist?list=PLabcdefghijkl',
            },
            { title: '', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
          ],
        }),
        topic('b', { videos: many }),
        topic('c', { videos: [video('dQw4w9WgXcQ'), video('dQw4w9WgXcQ')] }),
        topic('d', { videos: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' }),
      ]),
    );

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          '"https://youtu.be/dQw4w9WgXcQ" não está no formato',
        ),
        expect.stringContaining('&t=5" não está no formato'),
        expect.stringContaining(
          'playlist?list=PLabcdefghijkl" não está no formato',
        ),
        expect.stringContaining('vídeo sem title'),
        expect.stringContaining(`no máximo ${MAX_TOPIC_VIDEOS} vídeos`),
        expect.stringContaining('vídeo repetido'),
        expect.stringContaining('videos deve ser uma lista'),
      ]),
    );
  });
});

describe('quiz — perguntas por tópico (Fase 3)', () => {
  const question = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    question: `Pergunta ${id}?`,
    options: ['A', 'B', 'C', 'D'],
    answerIndex: 1,
    explanation: 'Porque B.',
    ...overrides,
  });
  const quizOf = (prefix: string, count = 4) =>
    Array.from({ length: count }, (_, index) =>
      question(`${prefix}-${index + 1}`),
    );

  it('aceita quiz válido e tópico sem quiz', () => {
    expect(
      problemsOf(track([topic('a', { quiz: quizOf('a') }), topic('b')])),
    ).toEqual([]);
  });

  it('recusa quiz curto ou longo demais', () => {
    const problems = problemsOf(
      track([
        topic('a', { quiz: quizOf('a', 2) }),
        topic('b', { quiz: quizOf('b', MAX_QUIZ_QUESTIONS + 1) }),
      ]),
    );
    expect(problems).toHaveLength(2);
  });

  it('recusa alternativas repetidas, em número errado ou resposta fora da faixa', () => {
    const problems = problemsOf(
      track([
        topic('a', {
          quiz: [
            question('a-1', { options: ['A', 'a ', 'C', 'D'] }),
            question('a-2', { options: ['A', 'B', 'C'] }),
            question('a-3', { answerIndex: 4 }),
            question('a-4', { explanation: '' }),
          ],
        }),
      ]),
    );
    expect(problems).toEqual([
      expect.stringContaining('"a-1": precisa de 4 alternativas'),
      expect.stringContaining('"a-2": precisa de 4 alternativas'),
      expect.stringContaining('"a-3": answerIndex deve ser de 0 a 3'),
      expect.stringContaining('"a-4": explanation vazia'),
    ]);
  });

  it('id de pergunta é único na trilha inteira', () => {
    const problems = problemsOf(
      track([
        topic('a', { quiz: quizOf('x') }),
        topic('b', { quiz: quizOf('x') }),
      ]),
    );
    expect(problems.filter((p) => p.includes('id repetido'))).toHaveLength(4);
  });
});

describe('challenges — desafios de código (Fase 4)', () => {
  const challenge = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    title: 'Somar pares',
    prompt: 'Implemente `somaPares`.',
    template: 'vanilla',
    files: { '/exercicio.js': 'export function somaPares() {}\n' },
    tests:
      "import { somaPares } from './exercicio';\ntest('soma', () => expect(somaPares([2])).toBe(2));\n",
    solution: {
      '/exercicio.js':
        'export function somaPares(n) { return n.filter((x) => x % 2 === 0).reduce((a, b) => a + b, 0); }\n',
    },
    ...overrides,
  });

  it('aceita desafio válido e tópico sem desafio', () => {
    expect(
      problemsOf(
        track([topic('a', { challenges: [challenge('a-1')] }), topic('b')]),
      ),
    ).toEqual([]);
  });

  it('recusa template, arquivos e testes inválidos', () => {
    const problems = problemsOf(
      track([
        topic('a', {
          challenges: [
            challenge('a-1', { template: 'angular' }),
            challenge('a-2', { files: { 'exercicio.js': 'x' } }),
          ],
        }),
        topic('b', {
          challenges: [
            challenge('b-1', { files: { '/exercicio.test.js': 'x' } }),
            challenge('b-2', { tests: 'console.log(1)' }),
          ],
        }),
        topic('c', {
          challenges: [challenge('c-1', { solution: { '/outro.js': 'x' } })],
        }),
      ]),
    );
    expect(problems).toEqual([
      expect.stringContaining('"a-1": template inválido'),
      expect.stringContaining('"a-2": files precisa'),
      expect.stringContaining('"b-1": files precisa'),
      expect.stringContaining('"b-2": tests precisa'),
      expect.stringContaining('"c-1": solution só pode ter arquivos'),
    ]);
  });

  it('limita desafios por tópico e exige id único na trilha', () => {
    const many = Array.from({ length: MAX_TOPIC_CHALLENGES + 1 }, (_, i) =>
      challenge(`a-${i + 1}`),
    );
    const problems = problemsOf(
      track([
        topic('a', { challenges: many }),
        topic('b', { challenges: [challenge('a-1')] }),
      ]),
    );
    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`no máximo ${MAX_TOPIC_CHALLENGES} desafios`),
        expect.stringContaining('id repetido na trilha'),
      ]),
    );
  });
});
