import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CHALLENGE_FILE_MAX_LENGTH,
  CHALLENGE_TEMPLATES,
  CHALLENGE_TEST_FILE,
  KNOWN_SKILLS,
  QUIZ_OPTION_COUNT,
  type ChallengeTemplate,
  TRACK_TOPIC_LEVELS,
  type KnownSkill,
  type TrackTopicLevel,
} from '@estudeai/shared-types';

/**
 * Conteúdo das trilhas curadas (docs/TRILHAS.md §2): tipos, leitura dos JSONs
 * versionados em `./content` e validação.
 *
 * Tudo aqui é função pura ou leitura de arquivo — sem Nest, sem banco. Quem
 * grava é o TrackSyncService; este arquivo só garante que o que chega nele é
 * conteúdo íntegro.
 */

/** As trilhas que existem. Um arquivo `<slug>.json` por item. */
export const TRACK_SLUGS = [
  'frontend',
  'backend',
  'fullstack',
  'devops',
] as const;
export type TrackSlug = (typeof TRACK_SLUGS)[number];

/** Link para a documentação oficial de um tópico (Fase 2). */
export interface TrackDocContent {
  title: string;
  /** https, num domínio de `OFFICIAL_DOC_HOSTS`. */
  url: string;
}

/**
 * Pergunta de quiz de um tópico (Fase 3). O `id` é estável e vai para o banco:
 * as tentativas dos usuários ficam presas a ele, então editar o texto da
 * pergunta não perde o histórico, mas trocar o `id` perde.
 */
export interface TrackQuizQuestionContent {
  id: string;
  question: string;
  /** Exatamente `QUIZ_OPTION_COUNT` alternativas, todas diferentes. */
  options: string[];
  /** Índice (0-based) da alternativa certa em `options`. */
  answerIndex: number;
  /** Por que a certa é a certa — mostrada depois da resposta. */
  explanation: string;
}

/**
 * Desafio de código de um tópico (Fase 4). Roda no Sandpack, no navegador da
 * pessoa: `files` é o código inicial, `tests` vira o arquivo
 * `CHALLENGE_TEST_FILE` (escondido no editor) e `solution` substitui `files`
 * no "ver solução". O `id` é estável, como o das perguntas de quiz.
 */
export interface TrackChallengeContent {
  id: string;
  title: string;
  prompt: string;
  template: ChallengeTemplate;
  files: Record<string, string>;
  tests: string;
  solution: Record<string, string>;
}

export interface TrackTopicContent {
  slug: string;
  title: string;
  level: TrackTopicLevel;
  required: boolean;
  estimatedHours: number;
  knownSkill: KnownSkill | null;
  prerequisites: string[];
  searchQuery: string;
  /** Documentação oficial curada (0 a `MAX_TOPIC_DOCS` links). Opcional. */
  docs?: TrackDocContent[];
  /** Quiz do tópico (`MIN_QUIZ_QUESTIONS` a `MAX_QUIZ_QUESTIONS`). Opcional. */
  quiz?: TrackQuizQuestionContent[];
  /** Desafios de código (até `MAX_TOPIC_CHALLENGES`). Opcional. */
  challenges?: TrackChallengeContent[];
}

export interface TrackProjectContent {
  title: string;
  description: string;
  estimatedHours: number;
}

export interface TrackModuleContent {
  slug: string;
  title: string;
  description: string;
  topics: TrackTopicContent[];
  project: TrackProjectContent;
}

export interface TrackContent {
  slug: TrackSlug;
  title: string;
  description: string;
  modules: TrackModuleContent[];
}

export interface LoadedTrack {
  content: TrackContent;
  /** SHA-256 do arquivo cru: muda com qualquer edição, inclusive de texto. */
  hash: string;
}

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Tamanho do quiz de um tópico: checagem rápida, não prova. */
export const MIN_QUIZ_QUESTIONS = 3;
export const MAX_QUIZ_QUESTIONS = 5;
const MAX_QUIZ_TEXT = 400;

/** Desafios por tópico: prática focada, não lista de exercícios. */
export const MAX_TOPIC_CHALLENGES = 2;
/** Arquivos que o desafio pode ter: o editor do Sandpack entende estes. */
const CHALLENGE_PATH =
  /^\/[a-zA-Z0-9_-]+(\/[a-zA-Z0-9_-]+)*\.(js|jsx|css|html)$/;

/** Teto de links de documentação por tópico: é leitura de apoio, não índice. */
export const MAX_TOPIC_DOCS = 4;

/**
 * Domínios aceitos como documentação OFICIAL (o projeto ou o mantenedor da
 * tecnologia). Subdomínios valem (`docs.aws.amazon.com` casa com
 * `aws.amazon.com`). Blog, curso e tutorial de terceiros ficam de fora: para
 * isso já existem os recursos buscados pela fila.
 */
export const OFFICIAL_DOC_HOSTS = [
  'developer.mozilla.org',
  'web.dev',
  'w3.org',
  'whatwg.org',
  'code.visualstudio.com',
  'developer.chrome.com',
  'git-scm.com',
  'docs.github.com',
  'nodejs.org',
  'docs.npmjs.com',
  'typescriptlang.org',
  'vite.dev',
  'vitejs.dev',
  'eslint.org',
  'prettier.io',
  'tailwindcss.com',
  'react.dev',
  'reactrouter.com',
  'nextjs.org',
  'vercel.com',
  'tanstack.com',
  'zustand.docs.pmnd.rs',
  'vitest.dev',
  'jestjs.io',
  'testing-library.com',
  'playwright.dev',
  'expressjs.com',
  'zod.dev',
  'swagger.io',
  'spec.openapis.org',
  'postgresql.org',
  'nestjs.com',
  'prisma.io',
  'typeorm.io',
  'jwt.io',
  'owasp.org',
  'oauth.net',
  'developers.google.com',
  'redis.io',
  'docs.bullmq.io',
  'docker.com',
  'nginx.org',
  'man7.org',
  'ubuntu.com',
  'debian.org',
  'kernel.org',
  'learn.microsoft.com',
  'gnu.org',
  'vim.org',
  'python.org',
  'yaml.org',
  'json.org',
  'about.gitlab.com',
  'docs.gitlab.com',
  'aws.amazon.com',
  'developer.hashicorp.com',
  'terraform.io',
  'docs.ansible.com',
  'kubernetes.io',
  'helm.sh',
  'prometheus.io',
  'grafana.com',
  'opentelemetry.io',
  'sre.google',
  'letsencrypt.org',
  'cloudflare.com',
  'rfc-editor.org',
  'ietf.org',
] as const;

/** true se a URL é https num domínio oficial (ou subdomínio dele). */
export function isOfficialDocUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  return OFFICIAL_DOC_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}
const MIN_TOPIC_HOURS = 1;
const MAX_TOPIC_HOURS = 40;

export class InvalidTrackContentError extends Error {
  constructor(
    readonly track: string,
    readonly problems: string[],
  ) {
    super(
      `Conteúdo inválido na trilha "${track}":\n- ${problems.join('\n- ')}`,
    );
    this.name = 'InvalidTrackContentError';
  }
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHours(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= MIN_TOPIC_HOURS &&
    (value as number) <= MAX_TOPIC_HOURS
  );
}

/**
 * Valida o JSON de uma trilha e o devolve tipado. Junta TODOS os problemas
 * antes de lançar: quem edita conteúdo quer a lista inteira, não um erro por
 * tentativa.
 *
 * Além do formato, garante as duas regras de que o recorte por pessoa depende
 * (docs/TRILHAS.md §5):
 *  - pré-requisito existe e vem ANTES na ordem de estudo;
 *  - tópico obrigatório nunca depende de opcional (senão cortar os opcionais
 *    para quem tem pouco tempo deixaria um buraco).
 */
export function validateTrackContent(
  raw: unknown,
  expectedSlug: string,
): TrackContent {
  const problems: string[] = [];
  const track = raw as Partial<TrackContent> | null;

  if (typeof track !== 'object' || track === null || Array.isArray(track)) {
    throw new InvalidTrackContentError(expectedSlug, [
      'a raiz do arquivo deve ser um objeto',
    ]);
  }

  if (track.slug !== expectedSlug) {
    problems.push(
      `slug "${String(track.slug)}" não bate com o arquivo "${expectedSlug}.json"`,
    );
  }
  if (!isText(track.title)) problems.push('trilha sem title');
  if (!isText(track.description)) problems.push('trilha sem description');

  const modules = Array.isArray(track.modules) ? track.modules : [];
  if (modules.length === 0) problems.push('trilha sem módulos');

  const moduleSlugs = new Set<string>();
  /** Ids de pergunta já vistos: únicos na trilha inteira. */
  const quizIds = new Set<string>();
  /** Ids de desafio já vistos: únicos na trilha inteira. */
  const challengeIds = new Set<string>();
  /** slug → required, só dos tópicos já percorridos (ou seja, anteriores). */
  const seenTopics = new Map<string, boolean>();

  for (const module of modules) {
    const where = `módulo "${String(module?.slug)}"`;

    if (!isText(module?.slug) || !SLUG_PATTERN.test(module.slug)) {
      problems.push(`${where}: slug ausente ou fora do kebab-case`);
    } else if (moduleSlugs.has(module.slug)) {
      problems.push(`${where}: slug de módulo duplicado`);
    } else {
      moduleSlugs.add(module.slug);
    }
    if (!isText(module?.title)) problems.push(`${where}: sem title`);
    if (!isText(module?.description))
      problems.push(`${where}: sem description`);

    const project = module?.project;
    if (
      !project ||
      !isText(project.title) ||
      !isText(project.description) ||
      !isHours(project.estimatedHours)
    ) {
      problems.push(`${where}: project ausente ou incompleto`);
    }

    const topics = Array.isArray(module?.topics) ? module.topics : [];
    if (topics.length === 0) problems.push(`${where}: sem tópicos`);

    for (const topic of topics) {
      const at = `tópico "${String(topic?.slug)}"`;

      if (!isText(topic?.slug) || !SLUG_PATTERN.test(topic.slug)) {
        problems.push(`${at}: slug ausente ou fora do kebab-case`);
        continue;
      }
      if (seenTopics.has(topic.slug)) {
        problems.push(`${at}: slug duplicado na trilha`);
        continue;
      }

      if (!isText(topic.title)) problems.push(`${at}: sem title`);
      if (!isText(topic.searchQuery)) problems.push(`${at}: sem searchQuery`);
      if (topic.docs !== undefined) {
        problems.push(...validateDocs(topic.docs, at));
      }
      if (topic.quiz !== undefined) {
        problems.push(...validateQuiz(topic.quiz, at, quizIds));
      }
      if (topic.challenges !== undefined) {
        problems.push(
          ...validateChallenges(topic.challenges, at, challengeIds),
        );
      }
      if (!TRACK_TOPIC_LEVELS.includes(topic.level)) {
        problems.push(`${at}: level inválido "${String(topic.level)}"`);
      }
      if (typeof topic.required !== 'boolean') {
        problems.push(`${at}: required deve ser true ou false`);
      }
      if (!isHours(topic.estimatedHours)) {
        problems.push(
          `${at}: estimatedHours deve ser inteiro entre ${MIN_TOPIC_HOURS} e ${MAX_TOPIC_HOURS}`,
        );
      }
      if (
        topic.knownSkill !== null &&
        !KNOWN_SKILLS.includes(topic.knownSkill)
      ) {
        problems.push(
          `${at}: knownSkill inválido "${String(topic.knownSkill)}"`,
        );
      }

      if (!Array.isArray(topic.prerequisites)) {
        problems.push(`${at}: prerequisites deve ser uma lista`);
      } else {
        for (const prerequisite of topic.prerequisites) {
          const prerequisiteRequired = seenTopics.get(prerequisite);
          if (prerequisiteRequired === undefined) {
            problems.push(
              `${at}: pré-requisito "${String(prerequisite)}" não existe ou vem depois`,
            );
          } else if (topic.required === true && !prerequisiteRequired) {
            problems.push(
              `${at}: é obrigatório mas depende do opcional "${prerequisite}"`,
            );
          }
        }
      }

      seenTopics.set(topic.slug, topic.required === true);
    }
  }

  if (problems.length > 0) {
    throw new InvalidTrackContentError(expectedSlug, problems);
  }
  return track as TrackContent;
}

/** Regras do campo `docs` de um tópico. Devolve os problemas encontrados. */
function validateDocs(docs: unknown, at: string): string[] {
  if (!Array.isArray(docs)) return [`${at}: docs deve ser uma lista`];

  const problems: string[] = [];
  if (docs.length > MAX_TOPIC_DOCS) {
    problems.push(`${at}: no máximo ${MAX_TOPIC_DOCS} links em docs`);
  }
  const seen = new Set<string>();
  for (const doc of docs as Partial<TrackDocContent>[]) {
    if (!isText(doc?.title)) problems.push(`${at}: doc sem title`);
    if (!isText(doc?.url) || !isOfficialDocUrl(doc.url)) {
      problems.push(
        `${at}: doc "${String(doc?.url)}" não é https num domínio oficial`,
      );
      continue;
    }
    if (seen.has(doc.url)) problems.push(`${at}: doc repetido "${doc.url}"`);
    seen.add(doc.url);
  }
  return problems;
}

function isShortText(value: unknown): value is string {
  return isText(value) && value.length <= MAX_QUIZ_TEXT;
}

/** Regras do campo `quiz` de um tópico. Devolve os problemas encontrados. */
function validateQuiz(
  quiz: unknown,
  at: string,
  seenIds: Set<string>,
): string[] {
  if (!Array.isArray(quiz)) return [`${at}: quiz deve ser uma lista`];

  const problems: string[] = [];
  if (quiz.length < MIN_QUIZ_QUESTIONS || quiz.length > MAX_QUIZ_QUESTIONS) {
    problems.push(
      `${at}: quiz deve ter de ${MIN_QUIZ_QUESTIONS} a ${MAX_QUIZ_QUESTIONS} perguntas`,
    );
  }
  for (const item of quiz as Partial<TrackQuizQuestionContent>[]) {
    const where = `${at}, pergunta "${String(item?.id)}"`;
    if (!isText(item?.id) || !SLUG_PATTERN.test(item.id)) {
      problems.push(`${where}: id ausente ou fora do kebab-case`);
      continue;
    }
    if (seenIds.has(item.id)) problems.push(`${where}: id repetido na trilha`);
    seenIds.add(item.id);

    if (!isShortText(item.question)) {
      problems.push(
        `${where}: question vazia ou com mais de ${MAX_QUIZ_TEXT} caracteres`,
      );
    }
    if (!isShortText(item.explanation)) {
      problems.push(
        `${where}: explanation vazia ou com mais de ${MAX_QUIZ_TEXT} caracteres`,
      );
    }
    const options = Array.isArray(item.options) ? item.options : [];
    if (
      options.length !== QUIZ_OPTION_COUNT ||
      !options.every(isShortText) ||
      new Set(options.map((option) => option.trim().toLowerCase())).size !==
        options.length
    ) {
      problems.push(
        `${where}: precisa de ${QUIZ_OPTION_COUNT} alternativas preenchidas e diferentes`,
      );
    }
    if (
      !Number.isInteger(item.answerIndex) ||
      (item.answerIndex as number) < 0 ||
      (item.answerIndex as number) >= QUIZ_OPTION_COUNT
    ) {
      problems.push(
        `${where}: answerIndex deve ser de 0 a ${QUIZ_OPTION_COUNT - 1}`,
      );
    }
  }
  return problems;
}

function validFiles(files: unknown): files is Record<string, string> {
  if (typeof files !== 'object' || files === null || Array.isArray(files)) {
    return false;
  }
  const entries = Object.entries(files);
  return (
    entries.length > 0 &&
    entries.every(
      ([path, code]) =>
        CHALLENGE_PATH.test(path) &&
        path !== CHALLENGE_TEST_FILE &&
        typeof code === 'string' &&
        code.length <= CHALLENGE_FILE_MAX_LENGTH,
    )
  );
}

/** Regras do campo `challenges` de um tópico. Devolve os problemas encontrados. */
function validateChallenges(
  challenges: unknown,
  at: string,
  seenIds: Set<string>,
): string[] {
  if (!Array.isArray(challenges))
    return [`${at}: challenges deve ser uma lista`];

  const problems: string[] = [];
  if (challenges.length > MAX_TOPIC_CHALLENGES) {
    problems.push(`${at}: no máximo ${MAX_TOPIC_CHALLENGES} desafios`);
  }
  for (const item of challenges as Partial<TrackChallengeContent>[]) {
    const where = `${at}, desafio "${String(item?.id)}"`;
    if (!isText(item?.id) || !SLUG_PATTERN.test(item.id)) {
      problems.push(`${where}: id ausente ou fora do kebab-case`);
      continue;
    }
    if (seenIds.has(item.id)) problems.push(`${where}: id repetido na trilha`);
    seenIds.add(item.id);

    if (!isText(item.title)) problems.push(`${where}: sem title`);
    if (!isText(item.prompt)) problems.push(`${where}: sem prompt`);
    if (!CHALLENGE_TEMPLATES.includes(item.template as ChallengeTemplate)) {
      problems.push(`${where}: template inválido "${String(item.template)}"`);
    }
    if (!validFiles(item.files)) {
      problems.push(
        `${where}: files precisa de arquivos .js/.jsx/.css/.html com caminho começando em /`,
      );
    }
    if (
      !isText(item.tests) ||
      item.tests.length > CHALLENGE_FILE_MAX_LENGTH ||
      !/\b(test|it)\s*\(/.test(item.tests)
    ) {
      problems.push(`${where}: tests precisa ter ao menos um test() ou it()`);
    }
    if (!validFiles(item.solution)) {
      problems.push(`${where}: solution inválida`);
    } else if (
      validFiles(item.files) &&
      !Object.keys(item.solution).every((path) => path in item.files!)
    ) {
      problems.push(
        `${where}: solution só pode ter arquivos que existem em files`,
      );
    }
  }
  return problems;
}

/** Lê, valida e calcula o hash de uma trilha. Lança se o conteúdo for inválido. */
export function loadTrack(
  slug: TrackSlug,
  directory: string = join(__dirname, 'content'),
): LoadedTrack {
  const file = readFileSync(join(directory, `${slug}.json`), 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(file);
  } catch (error) {
    throw new InvalidTrackContentError(slug, [
      `JSON malformado: ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
  return {
    content: validateTrackContent(parsed, slug),
    hash: createHash('sha256').update(file).digest('hex'),
  };
}
