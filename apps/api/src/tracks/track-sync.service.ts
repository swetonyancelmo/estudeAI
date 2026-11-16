import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { Track } from './entities/track.entity';
import { TrackModule } from './entities/track-module.entity';
import { TrackTopic } from './entities/track-topic.entity';
import { TrackTopicResource } from './entities/track-topic-resource.entity';
import {
  TRACK_SLUGS,
  loadTrack,
  type LoadedTrack,
  type TrackSlug,
} from './track-content';

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
            order: topicIndex,
            resourcesFetchedAt:
              oldTopic && !requeue ? oldTopic.resourcesFetchedAt : null,
          }),
        );
        keptTopicIds.add(topic.id);
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

    return existing ? 'updated' : 'created';
  }
}
