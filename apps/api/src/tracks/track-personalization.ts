import type {
  KnownSkill,
  TrackTopicLevel,
  WeeklyTime,
  WizardAnswers,
} from '@estudeai/shared-types';

/**
 * Recorte de uma trilha curada para UMA pessoa (docs/TRILHAS.md §5).
 *
 * Função pura sobre formas mínimas — não conhece entidade, banco nem Nest. É
 * aqui que mora a promessa do produto ("o roadmap cabe no seu tempo e respeita
 * o que você já sabe"), então é aqui que os testes por tabela se concentram.
 */

export interface TrackTopicShape {
  slug: string;
  level: TrackTopicLevel;
  required: boolean;
  knownSkill: KnownSkill | null;
  prerequisites: string[];
}

export interface TrackModuleShape<T extends TrackTopicShape> {
  topics: T[];
}

export interface PersonalizedTopic<T> {
  topic: T;
  /** true = a pessoa declarou já dominar a habilidade que dispensa o tópico. */
  alreadyKnown: boolean;
}

export interface PersonalizedModule<M, T> {
  module: M;
  topics: PersonalizedTopic<T>[];
}

/**
 * Profundidade por tempo semanal: quanto menos tempo, mais enxuto.
 *  - 5h: só o obrigatório.
 *  - 15h: mais os opcionais que não são avançados.
 *  - 30h+: a trilha inteira.
 */
function fitsDepth(topic: TrackTopicShape, weeklyTime: WeeklyTime): boolean {
  if (topic.required || weeklyTime === '30h+') {
    return true;
  }
  return weeklyTime === '15h' && topic.level !== 'avancado';
}

/**
 * Devolve os módulos e tópicos que entram no roadmap, na ordem da trilha.
 *
 * Espera módulos e tópicos JÁ ordenados. Como o conteúdo garante que
 * pré-requisito vem antes (validação da carga), uma passada só resolve a regra
 * "opcional só entra se tudo de que ele depende entrou". Tópico obrigatório
 * nunca cai nela: obrigatório não depende de opcional.
 *
 * O tópico de habilidade já dominada NÃO some — volta marcado `alreadyKnown`,
 * para nascer concluído. A pessoa vê o que foi considerado sabido e pode
 * desmarcar para revisar.
 *
 * Módulo que fica sem nenhum tópico é omitido.
 */
export function personalizeTrack<M extends TrackModuleShape<TrackTopicShape>>(
  modules: M[],
  answers: Pick<WizardAnswers, 'weeklyTime' | 'knownSkills'>,
): PersonalizedModule<M, M['topics'][number]>[] {
  const known = new Set<KnownSkill>(answers.knownSkills);
  const included = new Set<string>();

  return modules.flatMap((module) => {
    const topics = module.topics.flatMap((topic: M['topics'][number]) => {
      const enters =
        fitsDepth(topic, answers.weeklyTime) &&
        topic.prerequisites.every((slug) => included.has(slug));
      if (!enters) {
        return [];
      }
      included.add(topic.slug);
      return [
        {
          topic,
          alreadyKnown:
            topic.knownSkill !== null && known.has(topic.knownSkill),
        },
      ];
    });

    return topics.length > 0 ? [{ module, topics }] : [];
  });
}
