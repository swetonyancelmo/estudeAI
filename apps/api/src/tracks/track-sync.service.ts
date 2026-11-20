import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Track } from './entities/track.entity';
import { TrackModule } from './entities/track-module.entity';
import { TrackTopic } from './entities/track-topic.entity';
import { TrackTopicResource } from './entities/track-topic-resource.entity';
import { TrackQuizQuestion } from './entities/track-quiz-question.entity';
import { TrackChallenge } from './entities/track-challenge.entity';
import {
  TRACK_SLUGS,
  loadTrack,
  type LoadedTrack,
  type TrackChallengeContent,
  type TrackQuizQuestionContent,
  type TrackSlug,
} from './track-content';

/**
 * Leva a documentação oficial da trilha para os roadmaps que já existem
 * (Fase 2): cada tópico de usuário nascido de um tópico da trilha ganha os
 * links que ainda não tem, e as que já tem seguem a ordem de leitura do JSON.
 * Nunca apaga — doc tirada do JSON continua no roadmap de quem já tinha, junto
 * com o "lido" que a pessoa marcou nela.
 */
const COPY_DOCS_TO_USER_TOPICS_SQL = `
  INSERT INTO "topic_resources" ("topic_id", "title", "url", "type", "source", "order_index")
  SELECT t."id", d.doc->>'title', d.doc->>'url', 'article', 'docs', d.position - 1
  FROM "roadmap_topics" t
  JOIN "track_topics" tt ON tt."id" = t."track_topic_id"
  CROSS JOIN LATERAL jsonb_array_elements(tt."docs") WITH ORDINALITY AS d(doc, position)
  WHERE tt."track_id" = $1
  ON CONFLICT ("topic_id", "url") DO UPDATE
    SET "order_index" = EXCLUDED."order_index"
    WHERE "topic_resources"."source" = 'docs'
`;

/**
 * Idem para as videoaulas curadas (`videos`). Mesma regra das docs: só
 * acrescenta e atualiza a ordem; vídeo tirado do JSON continua com quem já
 * tinha. A miniatura é derivada do id do vídeo (host liberado no web).
 */
const COPY_VIDEOS_TO_USER_TOPICS_SQL = `
  INSERT INTO "topic_resources" ("topic_id", "title", "url", "type", "thumbnail_url", "source", "order_index")
  SELECT t."id", v.video->>'title', v.video->>'url', 'video',
    'https://i.ytimg.com/vi/' || substring(v.video->>'url' from 'v=([A-Za-z0-9_-]{11})$') || '/hqdefault.jpg',
    'youtube', v.position - 1
  FROM "roadmap_topics" t
  JOIN "track_topics" tt ON tt."id" = t."track_topic_id"
  CROSS JOIN LATERAL jsonb_array_elements(tt."videos") WITH ORDINALITY AS v(video, position)
  WHERE tt."track_id" = $1
  ON CONFLICT ("topic_id", "url") DO UPDATE
    SET "order_index" = EXCLUDED."order_index"
    WHERE "topic_resources"."source" = 'youtube'
`;

/** Chave do advisory lock: duas instâncias subindo juntas não sincronizam em paralelo. */
const SYNC_LOCK_KEY = 'estudeai:track-sync';

export type TrackSyncOutcome = 'unchanged' | 'created' | 'updated';

/**
 * Leva o conteúdo dos JSONs (`./content`) para o banco, no boot.
 *
 * O JSON é a fonte de verdade e o banco é o espelho: se o hash do arquivo bate
 * com `tracks.content_hash`, não há nada a fazer (o caso de quase todo boot).
 *
 * Quando muda, a trilha é ATUALIZADA NO LUGAR, casando módulos e tópicos pelo
 * slug — nunca apagada e recriada. Isso mantém os ids estáveis, e é o que
 * preserva os recursos já buscados (cada um custou cota do YouTube): um tópico
 * só volta para a fila de busca se o `searchQuery` dele mudou.
 *
 * Roadmaps de usuários não são tocados: são cópias (Etapa 6).
 */
@Injectable()
export class TrackSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TrackSyncService.name);

  constructor(private readonly dataSource: DataSource) {}

  /**
   * Conteúdo quebrado não derruba a API: a trilha afetada fica como estava no
   * banco e o erro vai para o log. (O spec do conteúdo real existe justamente
   * para isso nunca chegar em produção.)
   */
  async onApplicationBootstrap(): Promise<void> {
    for (const slug of TRACK_SLUGS) {
      try {
        const outcome = await this.syncTrack(slug);
        if (outcome !== 'unchanged') {
          this.logger.log(`Trilha "${slug}" sincronizada (${outcome}).`);
        }
      } catch (error) {
        this.logger.error(
          `Falha ao sincronizar a trilha "${slug}": ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  async syncTrack(
    slug: TrackSlug,
    loaded: LoadedTrack = loadTrack(slug),
  ): Promise<TrackSyncOutcome> {
    return this.dataSource.transaction((manager) =>
      this.apply(manager, loaded),
    );
  }

  private async apply(
    manager: EntityManager,
    { content, hash }: LoadedTrack,
  ): Promise<TrackSyncOutcome> {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      SYNC_LOCK_KEY,
    ]);

    const existing = await manager.findOne(Track, {
      where: { slug: content.slug },
    });
    if (existing?.contentHash === hash) {
      return 'unchanged';
    }

    const track = await manager.save(
      manager.merge(Track, existing ?? manager.create(Track), {
        slug: content.slug,
        title: content.title,
        description: content.description,
        contentHash: hash,
      }),
    );

    const [oldModules, oldTopics] = existing
      ? await Promise.all([
          manager.find(TrackModule, { where: { trackId: track.id } }),
          manager.find(TrackTopic, { where: { trackId: track.id } }),
        ])
      : [[], []];
    const modulesBySlug = new Map(oldModules.map((m) => [m.slug, m]));
    const topicsBySlug = new Map(oldTopics.map((t) => [t.slug, t]));

    const keptModuleIds = new Set<string>();
    const keptTopicIds = new Set<string>();
    const requeuedTopicIds: string[] = [];

    for (const [moduleIndex, moduleContent] of content.modules.entries()) {
      const module = await manager.save(
        manager.merge(
          TrackModule,
          modulesBySlug.get(moduleContent.slug) ?? manager.create(TrackModule),
          {
            trackId: track.id,
            slug: moduleContent.slug,
            title: moduleContent.title,
            description: moduleContent.description,
            order: moduleIndex,
            projectTitle: moduleContent.project.title,
            projectDescription: moduleContent.project.description,
            projectHours: moduleContent.project.estimatedHours,
          },
        ),
      );
      keptModuleIds.add(module.id);

      for (const [topicIndex, topicContent] of moduleContent.topics.entries()) {
        const oldTopic = topicsBySlug.get(topicContent.slug);
        // Busca diferente = links antigos não valem mais: volta para a fila.
        const requeue =
          oldTopic !== undefined &&
          oldTopic.searchQuery !== topicContent.searchQuery;

        const topic = await manager.save(
          manager.merge(TrackTopic, oldTopic ?? manager.create(TrackTopic), {
            trackId: track.id,
            // Casar por slug na TRILHA permite mover tópico de módulo sem perdê-lo.
            moduleId: module.id,
            slug: topicContent.slug,
            title: topicContent.title,
            level: topicContent.level,
            required: topicContent.required,
            estimatedHours: topicContent.estimatedHours,
            knownSkill: topicContent.knownSkill,
            prerequisites: topicContent.prerequisites,
            searchQuery: topicContent.searchQuery,
            docs: topicContent.docs ?? [],
            videos: topicContent.videos ?? [],
            order: topicIndex,
            resourcesFetchedAt:
              oldTopic && !requeue ? oldTopic.resourcesFetchedAt : null,
          }),
        );
        keptTopicIds.add(topic.id);
        await this.syncQuiz(manager, topic.id, topicContent.quiz ?? []);
        await this.syncChallenges(
          manager,
          topic.id,
          topicContent.challenges ?? [],
        );
        if (requeue) {
          requeuedTopicIds.push(topic.id);
        }
      }
    }

    if (requeuedTopicIds.length > 0) {
      await manager.delete(TrackTopicResource, {
        trackTopicId: In(requeuedTopicIds),
      });
    }

    // Tópicos antes dos módulos: os que mudaram de módulo já foram regravados
    // acima, então o cascade do módulo removido só leva o que saiu de verdade.
    const removedTopicIds = oldTopics
      .filter((topic) => !keptTopicIds.has(topic.id))
      .map((topic) => topic.id);
    if (removedTopicIds.length > 0) {
      await manager.delete(TrackTopic, { id: In(removedTopicIds) });
    }

    const removedModuleIds = oldModules
      .filter((module) => !keptModuleIds.has(module.id))
      .map((module) => module.id);
    if (removedModuleIds.length > 0) {
      await manager.delete(TrackModule, { id: In(removedModuleIds) });
    }

    await manager.query(COPY_DOCS_TO_USER_TOPICS_SQL, [track.id]);
    await manager.query(COPY_VIDEOS_TO_USER_TOPICS_SQL, [track.id]);

    return existing ? 'updated' : 'created';
  }

  /**
   * Desafios de código de um tópico (Fase 4), casados pelo `id` do JSON como
   * as perguntas de quiz: o uuid fica estável e o progresso dos usuários
   * continua preso a ele. Desafio tirado do JSON é apagado com o progresso.
   */
  private async syncChallenges(
    manager: EntityManager,
    trackTopicId: string,
    challenges: TrackChallengeContent[],
  ): Promise<void> {
    const existing = await manager.find(TrackChallenge, {
      where: { trackTopicId },
    });
    const bySlug = new Map(existing.map((row) => [row.slug, row]));
    const kept = new Set<string>();

    for (const [order, item] of challenges.entries()) {
      const row = await manager.save(
        manager.merge(
          TrackChallenge,
          bySlug.get(item.id) ?? manager.create(TrackChallenge),
          {
            trackTopicId,
            slug: item.id,
            title: item.title,
            prompt: item.prompt,
            template: item.template,
            files: item.files,
            tests: item.tests,
            solution: item.solution,
            order,
          },
        ),
      );
      kept.add(row.id);
    }

    const removed = existing
      .filter((row) => !kept.has(row.id))
      .map((row) => row.id);
    if (removed.length > 0) {
      await manager.delete(TrackChallenge, { id: In(removed) });
    }
  }

  /**
   * Perguntas de quiz de um tópico (Fase 3), casadas pelo `id` do JSON (slug
   * no banco). Assim o uuid de cada pergunta não muda entre syncs, e as
   * tentativas dos usuários continuam presas a ela mesmo quando o texto é
   * corrigido. Pergunta que saiu do JSON é apagada, e as tentativas nela vão
   * junto (CASCADE).
   */
  private async syncQuiz(
    manager: EntityManager,
    trackTopicId: string,
    quiz: TrackQuizQuestionContent[],
  ): Promise<void> {
    const existing = await manager.find(TrackQuizQuestion, {
      where: { trackTopicId },
    });
    const bySlug = new Map(existing.map((row) => [row.slug, row]));
    const kept = new Set<string>();

    for (const [order, item] of quiz.entries()) {
      const row = await manager.save(
        manager.merge(
          TrackQuizQuestion,
          bySlug.get(item.id) ?? manager.create(TrackQuizQuestion),
          {
            trackTopicId,
            slug: item.id,
            question: item.question,
            options: item.options,
            answerIndex: item.answerIndex,
            explanation: item.explanation,
            order,
          },
        ),
      );
      kept.add(row.id);
    }

    const removed = existing
      .filter((row) => !kept.has(row.id))
      .map((row) => row.id);
    if (removed.length > 0) {
      await manager.delete(TrackQuizQuestion, { id: In(removed) });
    }
  }
}
