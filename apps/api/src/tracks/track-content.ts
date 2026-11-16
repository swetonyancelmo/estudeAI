import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  KNOWN_SKILLS,
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

export interface TrackTopicContent {
  slug: string;
  title: string;
  level: TrackTopicLevel;
  required: boolean;
  estimatedHours: number;
  knownSkill: KnownSkill | null;
  prerequisites: string[];
  searchQuery: string;
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
