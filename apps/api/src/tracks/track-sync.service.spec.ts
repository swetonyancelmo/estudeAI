import type { DataSource } from 'typeorm';
import { Track } from './entities/track.entity';
import { TrackModule } from './entities/track-module.entity';
import { TrackTopic } from './entities/track-topic.entity';
import { TrackTopicResource } from './entities/track-topic-resource.entity';
import type { LoadedTrack, TrackContent } from './track-content';
import { TrackSyncService } from './track-sync.service';

type Row = Record<string, unknown> & { id: string };

/**
 * EntityManager em memória, com o mínimo que o sync usa. Não substitui um teste
 * contra Postgres (constraints e cascade ficam de fora); cobre a LÓGICA de
 * casar por slug, que é onde mora o risco de perder recursos já buscados.
 */
function fakeDatabase() {
  const tables = new Map<unknown, Row[]>([
    [Track, []],
    [TrackModule, []],
    [TrackTopic, []],
  ]);
  const deletedResourcesOf: string[] = [];
  let nextId = 1;

  const rows = (entity: unknown) => tables.get(entity)!;
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => row[key] === value);

  const manager = {
    query: jest.fn(),
    create: () => ({}),
    merge: (_entity: unknown, target: object, source: object) =>
      Object.assign(target, source),
    findOne: (entity: unknown, { where }: { where: Record<string, unknown> }) =>
      Promise.resolve(rows(entity).find((row) => matches(row, where)) ?? null),
    find: (entity: unknown, { where }: { where: Record<string, unknown> }) =>
      Promise.resolve(rows(entity).filter((row) => matches(row, where))),
    save: (row: Row) => {
      if (!row.id) {
        row.id = `id-${nextId++}`;
        const table =
          'contentHash' in row
            ? Track
            : 'projectTitle' in row
              ? TrackModule
              : TrackTopic;
        rows(table).push(row);
      }
      return Promise.resolve(row);
    },
    delete: (entity: unknown, where: Record<string, { _value: string[] }>) => {
      const ids = Object.values(where)[0]._value;
      if (entity === TrackTopicResource) {
        deletedResourcesOf.push(...ids);
      } else {
        tables.set(
          entity,
          rows(entity).filter((row) => !ids.includes(row.id)),
        );
      }
      return Promise.resolve();
    },
  };

  const dataSource = {
    transaction: (work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
  } as unknown as DataSource;

  return { dataSource, manager, rows, deletedResourcesOf };
}

function loaded(hash: string, modules: TrackContent['modules']): LoadedTrack {
  return {
    hash,
    content: {
      slug: 'frontend',
      title: 'Frontend',
      description: 'Trilha de teste.',
      modules,
    },
  };
}

function moduleOf(
  slug: string,
  topics: { slug: string; searchQuery?: string }[],
): TrackContent['modules'][number] {
  return {
    slug,
    title: `Módulo ${slug}`,
    description: 'Descrição.',
    project: { title: 'Projeto', description: 'Construa.', estimatedHours: 8 },
    topics: topics.map((item) => ({
      slug: item.slug,
      title: `Tópico ${item.slug}`,
      level: 'iniciante',
      required: true,
      estimatedHours: 3,
      knownSkill: null,
      prerequisites: [],
      searchQuery: item.searchQuery ?? `busca ${item.slug}`,
    })),
  };
}

describe('TrackSyncService', () => {
  const v1 = loaded('hash-1', [
    moduleOf('base', [{ slug: 'html' }, { slug: 'css' }]),
    moduleOf('js', [{ slug: 'variaveis' }]),
  ]);

  it('cria a trilha na primeira carga, com tudo na fila de recursos', async () => {
    const db = fakeDatabase();
    const service = new TrackSyncService(db.dataSource);

    expect(await service.syncTrack('frontend', v1)).toBe('created');

    expect(db.rows(TrackModule).map((m) => [m.slug, m.order])).toEqual([
      ['base', 0],
      ['js', 1],
    ]);
    expect(db.rows(TrackTopic)).toHaveLength(3);
    expect(
      db.rows(TrackTopic).every((t) => t.resourcesFetchedAt === null),
    ).toBe(true);
  });

  it('não escreve nada quando o hash do arquivo não mudou', async () => {
    const db = fakeDatabase();
    const service = new TrackSyncService(db.dataSource);
    await service.syncTrack('frontend', v1);
    const save = jest.spyOn(db.manager, 'save');

    expect(await service.syncTrack('frontend', v1)).toBe('unchanged');
    expect(save).not.toHaveBeenCalled();
  });

  it('atualiza no lugar: ids estáveis, e só o tópico com searchQuery novo volta para a fila', async () => {
    const db = fakeDatabase();
    const service = new TrackSyncService(db.dataSource);
    await service.syncTrack('frontend', v1);

    const fetchedAt = new Date('2026-11-01T00:00:00Z');
    for (const topic of db.rows(TrackTopic)) {
      topic.resourcesFetchedAt = fetchedAt;
    }
    const idOf = (slug: string) =>
      db.rows(TrackTopic).find((t) => t.slug === slug)!.id;
    const htmlId = idOf('html');
    const cssId = idOf('css');

    const v2 = loaded('hash-2', [
      moduleOf('base', [
        { slug: 'html' },
        { slug: 'css', searchQuery: 'css moderno curso' },
      ]),
      moduleOf('js', [{ slug: 'variaveis' }]),
    ]);

    expect(await service.syncTrack('frontend', v2)).toBe('updated');

    expect(idOf('html')).toBe(htmlId);
    expect(idOf('css')).toBe(cssId);
    const bySlug = (slug: string) =>
      db.rows(TrackTopic).find((t) => t.slug === slug)!;
    expect(bySlug('html').resourcesFetchedAt).toBe(fetchedAt);
    expect(bySlug('css').resourcesFetchedAt).toBeNull();
    expect(db.deletedResourcesOf).toEqual([cssId]);
  });

  it('move tópico de módulo sem recriá-lo e remove o que saiu do conteúdo', async () => {
    const db = fakeDatabase();
    const service = new TrackSyncService(db.dataSource);
    await service.syncTrack('frontend', v1);
    const cssId = db.rows(TrackTopic).find((t) => t.slug === 'css')!.id;

    // "css" vai para o módulo "js"; "html" e o módulo "base" deixam de existir.
    const v2 = loaded('hash-2', [
      moduleOf('js', [{ slug: 'variaveis' }, { slug: 'css' }]),
    ]);
    await service.syncTrack('frontend', v2);

    const jsModule = db.rows(TrackModule).find((m) => m.slug === 'js')!;
    const css = db.rows(TrackTopic).find((t) => t.slug === 'css')!;
    expect(css.id).toBe(cssId);
    expect(css.moduleId).toBe(jsModule.id);
    expect(css.order).toBe(1);
    expect(
      db
        .rows(TrackTopic)
        .map((t) => t.slug)
        .sort(),
    ).toEqual(['css', 'variaveis']);
    expect(db.rows(TrackModule).map((m) => m.slug)).toEqual(['js']);
  });
});
