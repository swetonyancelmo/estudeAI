import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceDiscoveryService } from '../roadmap/resource-discovery.service';
import { TrackTopic } from './entities/track-topic.entity';
import { TrackTopicResource } from './entities/track-topic-resource.entity';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_BATCH = 25;
const DEFAULT_DELAY_MS = 250;
/** Deixa o boot terminar (sync das trilhas incluso) antes da primeira rodada. */
const FIRST_RUN_DELAY_MS = 5_000;

/**
 * Roadmaps criados ANTES de a fila chegar num tópico nasceram sem links nele.
 * Quando o tópico da trilha é preenchido, os tópicos de usuários que vieram
 * dele e continuam sem nenhum recurso recebem os mesmos links.
 *
 * `NOT EXISTS` em vez de ON CONFLICT: quem já tem qualquer recurso (inclusive
 * os trocados por um reajuste) não é tocado.
 */
const COPY_TO_USER_TOPICS_SQL = `
  INSERT INTO "topic_resources" ("topic_id", "title", "url", "type", "thumbnail_url", "source")
  SELECT t."id", r."title", r."url", r."type", r."thumbnail_url", r."source"
  FROM "roadmap_topics" t
  JOIN "track_topic_resources" r ON r."track_topic_id" = t."track_topic_id"
  WHERE t."track_topic_id" = $1
    AND NOT EXISTS (
      SELECT 1 FROM "topic_resources" existing
      WHERE existing."topic_id" = t."id"
        -- Documentação oficial e videoaulas curadas chegam pelo JSON, não pela
        -- fila: não contam como "já tem recursos", senão o tópico nunca
        -- receberia os links buscados.
        AND existing."source" <> 'docs'
        AND NOT EXISTS (
          SELECT 1 FROM "track_topics" curated,
            jsonb_array_elements(curated."videos") AS video
          WHERE curated."id" = t."track_topic_id"
            AND video->>'url' = existing."url"
        )
    )
  -- Se a fila achou o mesmo vídeo que o JSON já curou, fica o do JSON.
  ON CONFLICT ("topic_id", "url") DO NOTHING
`;

export interface TrackResourceRunResult {
  /** Tópicos que ganharam recursos (ou a confirmação de que não há) nesta rodada. */
  filled: number;
  /** true quando a rodada parou porque o YouTube recusou a busca (cota). */
  stoppedByYoutube: boolean;
}

/**
 * Preenche, em segundo plano, os recursos de estudo dos tópicos das trilhas
 * (docs/TRILHAS.md §8).
 *
 * Por que não buscar na hora da geração, como na Etapa 8: são 210 tópicos e a
 * cota gratuita do YouTube rende ~100 buscas por dia. A carga inicial leva
 * dias, então ela precisa ser uma fila retomável — e a fila é a própria coluna
 * `resources_fetched_at IS NULL`, sem tabela extra nem estado em memória.
 *
 * A regra que sustenta isso: um tópico só sai da fila se a busca do YouTube
 * RESPONDEU. Cota estourada não é "não achei nada" — se fosse tratada assim,
 * o primeiro dia de cota esgotada deixaria metade do catálogo sem vídeos para
 * sempre. Ao primeiro erro do YouTube a rodada para e a próxima retoma dali.
 */
@Injectable()
export class TrackResourceSyncService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(TrackResourceSyncService.name);
  private firstRun: NodeJS.Timeout | null = null;
  private interval: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly discovery: ResourceDiscoveryService,
    @InjectRepository(TrackTopic)
    private readonly topics: Repository<TrackTopic>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('TRACK_RESOURCE_SYNC_ENABLED') === 'false') {
      this.logger.log('Busca de recursos das trilhas desligada por config.');
      return;
    }
    if (!this.discovery.canSearchYoutube()) {
      this.logger.warn(
        'Busca de recursos das trilhas inativa: descoberta desligada ou YOUTUBE_API_KEY ausente.',
      );
      return;
    }

    const tick = () => void this.runSafely();
    // unref: um timer pendente nunca segura o processo vivo no shutdown.
    this.firstRun = setTimeout(tick, FIRST_RUN_DELAY_MS).unref();
    this.interval = setInterval(tick, this.intervalMs()).unref();
  }

  onModuleDestroy(): void {
    if (this.firstRun) clearTimeout(this.firstRun);
    if (this.interval) clearInterval(this.interval);
  }

  /**
   * Uma rodada: até `TRACK_RESOURCE_SYNC_BATCH` tópicos pendentes, um por vez.
   *
   * A ordem é por posição do módulo antes da trilha: os primeiros módulos das
   * QUATRO trilhas são preenchidos antes do segundo de qualquer uma — é por
   * onde todo usuário começa, então é o que precisa de link primeiro.
   */
  async runOnce(): Promise<TrackResourceRunResult> {
    const pending = await this.topics
      .createQueryBuilder('topic')
      .innerJoin('topic.module', 'module')
      .where('topic.resourcesFetchedAt IS NULL')
      .orderBy('module.order', 'ASC')
      .addOrderBy('topic.order', 'ASC')
      .addOrderBy('topic.trackId', 'ASC')
      .take(this.batchSize())
      .getMany();

    let filled = 0;
    for (const [index, topic] of pending.entries()) {
      if (index > 0) {
        await this.sleep(this.delayMs());
      }

      const { resources, youtubeOk } =
        await this.discovery.discoverForTrackTopic({
          title: topic.title,
          searchQuery: topic.searchQuery,
        });
      if (!youtubeOk) {
        return { filled, stoppedByYoutube: true };
      }

      await this.topics.manager.transaction(async (manager) => {
        await manager.delete(TrackTopicResource, { trackTopicId: topic.id });
        if (resources.length > 0) {
          await manager.insert(
            TrackTopicResource,
            resources.map((resource, order) => ({
              trackTopicId: topic.id,
              title: resource.title,
              url: resource.url,
              type: resource.type,
              thumbnailUrl: resource.thumbnailUrl ?? null,
              source: resource.source,
              order,
            })),
          );
        }
        await manager.update(
          TrackTopic,
          { id: topic.id },
          { resourcesFetchedAt: new Date() },
        );
        if (resources.length > 0) {
          await manager.query(COPY_TO_USER_TOPICS_SQL, [topic.id]);
        }
      });
      filled += 1;
    }

    return { filled, stoppedByYoutube: false };
  }

  /** Invólucro do timer: sem sobreposição de rodadas e sem rejeição solta. */
  private async runSafely(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const { filled, stoppedByYoutube } = await this.runOnce();
      if (filled > 0 || stoppedByYoutube) {
        const remaining = await this.topics
          .createQueryBuilder('topic')
          .where('topic.resourcesFetchedAt IS NULL')
          .getCount();
        this.logger.log(
          `Recursos das trilhas: ${filled} tópico(s) preenchido(s), ${remaining} na fila` +
            (stoppedByYoutube
              ? ' — YouTube recusou a busca (cota?), retomando na próxima rodada.'
              : '.'),
        );
      }
    } catch (error) {
      this.logger.error(
        `Rodada de recursos das trilhas falhou: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }

  private intervalMs(): number {
    return this.positiveNumber(
      'TRACK_RESOURCE_SYNC_INTERVAL_MS',
      DEFAULT_INTERVAL_MS,
    );
  }

  private batchSize(): number {
    return Math.floor(
      this.positiveNumber('TRACK_RESOURCE_SYNC_BATCH', DEFAULT_BATCH),
    );
  }

  private delayMs(): number {
    const raw = this.config.get<string>('RESOURCE_DISCOVERY_DELAY_MS');
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_DELAY_MS;
  }

  private positiveNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
  }

  private sleep(ms: number): Promise<void> {
    return ms > 0
      ? new Promise((resolve) => setTimeout(resolve, ms))
      : Promise.resolve();
  }
}
