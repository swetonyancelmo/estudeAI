import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { ResourceDiscoveryService } from '../roadmap/resource-discovery.service';
import { TrackTopic } from './entities/track-topic.entity';
import { TrackTopicResource } from './entities/track-topic-resource.entity';
import { TrackResourceSyncService } from './track-resource-sync.service';

const video = {
  title: 'Flexbox',
  url: 'https://www.youtube.com/watch?v=v1',
  type: 'video' as const,
  source: 'youtube' as const,
  thumbnailUrl: 'https://i.ytimg.com/vi/v1/mq.jpg',
};
const article = {
  title: 'Guia de Flexbox',
  url: 'https://developer.mozilla.org/flexbox',
  type: 'article' as const,
  source: 'web' as const,
};

function pendingTopic(id: string): TrackTopic {
  return {
    id,
    title: `Tópico ${id}`,
    searchQuery: `busca ${id}`,
  } as TrackTopic;
}

function build(options: {
  pending: TrackTopic[];
  env?: Record<string, string | undefined>;
  canSearchYoutube?: boolean;
}) {
  const env: Record<string, string | undefined> = {
    RESOURCE_DISCOVERY_DELAY_MS: '0',
    ...options.env,
  };
  const config = {
    get: jest.fn((key: string) => env[key]),
  } as unknown as ConfigService;

  const discovery = {
    canSearchYoutube: jest.fn(() => options.canSearchYoutube ?? true),
    discoverForTrackTopic: jest.fn(),
  };

  const manager = {
    delete: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
  };
  const queryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(options.pending),
    getCount: jest.fn().mockResolvedValue(0),
  };
  const topics = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    manager: {
      transaction: jest.fn((work: (m: typeof manager) => Promise<void>) =>
        work(manager),
      ),
    },
  } as unknown as Repository<TrackTopic>;

  const service = new TrackResourceSyncService(
    config,
    discovery as unknown as ResourceDiscoveryService,
    topics,
  );
  return { service, discovery, manager, queryBuilder };
}

describe('TrackResourceSyncService', () => {
  afterEach(() => jest.useRealTimers());

  it('grava os recursos na ordem devolvida e tira o tópico da fila', async () => {
    const { service, discovery, manager } = build({
      pending: [pendingTopic('t-1')],
    });
    discovery.discoverForTrackTopic.mockResolvedValue({
      resources: [video, article],
      youtubeOk: true,
    });

    const result = await service.runOnce();

    expect(result).toEqual({ filled: 1, stoppedByYoutube: false });
    expect(discovery.discoverForTrackTopic).toHaveBeenCalledWith({
      title: 'Tópico t-1',
      searchQuery: 'busca t-1',
    });
    expect(manager.insert).toHaveBeenCalledWith(TrackTopicResource, [
      expect.objectContaining({
        trackTopicId: 't-1',
        url: video.url,
        order: 0,
      }),
      expect.objectContaining({
        trackTopicId: 't-1',
        url: article.url,
        thumbnailUrl: null,
        order: 1,
      }),
    ]);
    expect(manager.update).toHaveBeenCalledWith(
      TrackTopic,
      { id: 't-1' },
      { resourcesFetchedAt: expect.any(Date) as Date },
    );
    // Roadmaps criados antes de a fila chegar aqui recebem os mesmos links.
    expect(manager.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "topic_resources"'),
      ['t-1'],
    );
  });

  it('busca que respondeu vazia também resolve o tópico (não insiste à toa)', async () => {
    const { service, discovery, manager } = build({
      pending: [pendingTopic('t-1')],
    });
    discovery.discoverForTrackTopic.mockResolvedValue({
      resources: [],
      youtubeOk: true,
    });

    const result = await service.runOnce();

    expect(result.filled).toBe(1);
    expect(manager.insert).not.toHaveBeenCalled();
    expect(manager.update).toHaveBeenCalledTimes(1);
    expect(manager.query).not.toHaveBeenCalled();
  });

  it('para no primeiro erro do YouTube e deixa esse tópico e os seguintes na fila', async () => {
    const { service, discovery, manager } = build({
      pending: [pendingTopic('t-1'), pendingTopic('t-2'), pendingTopic('t-3')],
    });
    discovery.discoverForTrackTopic
      .mockResolvedValueOnce({ resources: [video], youtubeOk: true })
      // Cota estourada: mesmo com artigos em mãos, nada é gravado.
      .mockResolvedValueOnce({ resources: [article], youtubeOk: false });

    const result = await service.runOnce();

    expect(result).toEqual({ filled: 1, stoppedByYoutube: true });
    expect(discovery.discoverForTrackTopic).toHaveBeenCalledTimes(2);
    expect(manager.update).toHaveBeenCalledTimes(1);
    expect(manager.update).toHaveBeenCalledWith(
      TrackTopic,
      { id: 't-1' },
      expect.anything(),
    );
  });

  it('respeita TRACK_RESOURCE_SYNC_BATCH ao montar a fila', async () => {
    const { service, queryBuilder } = build({
      pending: [],
      env: { TRACK_RESOURCE_SYNC_BATCH: '7' },
    });

    await service.runOnce();

    expect(queryBuilder.take).toHaveBeenCalledWith(7);
  });

  describe('agendamento no boot', () => {
    it.each([
      ['desligado por config', { TRACK_RESOURCE_SYNC_ENABLED: 'false' }, true],
      ['sem como buscar no YouTube', {}, false],
    ])('não agenda nada quando %s', (_label, env, canSearchYoutube) => {
      jest.useFakeTimers();
      const { service, discovery } = build({
        pending: [pendingTopic('t-1')],
        env,
        canSearchYoutube,
      });

      service.onApplicationBootstrap();
      jest.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(discovery.discoverForTrackTopic).not.toHaveBeenCalled();
    });

    it('agenda a primeira rodada logo após o boot e para no shutdown', async () => {
      jest.useFakeTimers();
      const { service, queryBuilder } = build({ pending: [] });

      service.onApplicationBootstrap();
      await jest.advanceTimersByTimeAsync(5_000);
      expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);

      service.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(3 * 60 * 60 * 1000);
      expect(queryBuilder.getMany).toHaveBeenCalledTimes(1);
    });
  });
});
