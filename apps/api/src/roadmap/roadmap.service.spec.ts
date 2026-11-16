import { ServiceUnavailableException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { RoadmapDetailDto, WizardAnswers } from '@estudeai/shared-types';
import type { Track } from '../tracks/entities/track.entity';
import { RoadmapService } from './roadmap.service';
import type { TrackJustificationService } from './track-justification.service';
import type { RoadmapDraft, UserRoadmapService } from './user-roadmap.service';

function trackTopic(
  id: string,
  order: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    slug: id,
    title: `Tópico ${id}`,
    level: 'iniciante',
    required: true,
    estimatedHours: 3,
    knownSkill: null,
    prerequisites: [],
    order,
    resources: [],
    ...overrides,
  };
}

/** Trilha como o findOne com relations devolve — fora de ordem de propósito. */
function makeTrack(): Track {
  return {
    id: 'track-1',
    slug: 'frontend',
    modules: [
      {
        id: 'm-2',
        title: 'Aprofundamento',
        description: 'Só opcionais.',
        order: 1,
        topics: [trackTopic('extra', 0, { required: false })],
      },
      {
        id: 'm-1',
        title: 'Fundamentos',
        description: 'A base.',
        order: 0,
        topics: [
          trackTopic('css', 1, {
            resources: [
              {
                title: 'Artigo',
                url: 'https://mdn.dev/css',
                type: 'article',
                source: 'web',
                thumbnailUrl: null,
                order: 1,
              },
              {
                title: 'Aula',
                url: 'https://youtu.be/css',
                type: 'video',
                source: 'youtube',
                thumbnailUrl: 'https://i.ytimg.com/css.jpg',
                order: 0,
              },
            ],
          }),
          trackTopic('html', 0, { knownSkill: 'html-css' }),
        ],
      },
      {
        id: 'm-3',
        title: 'JavaScript',
        description: 'A linguagem.',
        order: 2,
        topics: [trackTopic('js', 0)],
      },
    ],
  } as unknown as Track;
}

describe('RoadmapService (geração por trilha curada)', () => {
  const userId = 'user-1';
  const persisted = { id: 'roadmap-1' } as RoadmapDetailDto;

  const answers: WizardAnswers = {
    goal: 'mercado',
    area: 'frontend',
    knownSkills: ['html-css'],
    weeklyTime: '5h',
    learningStyle: 'pratico',
  };

  let tracks: { findOne: jest.Mock };
  let justification: { write: jest.Mock };
  let userRoadmaps: { createFrom: jest.Mock };
  let service: RoadmapService;

  beforeEach(() => {
    tracks = { findOne: jest.fn().mockResolvedValue(makeTrack()) };
    justification = { write: jest.fn().mockResolvedValue('porque sim') };
    userRoadmaps = { createFrom: jest.fn().mockResolvedValue(persisted) };
    service = new RoadmapService(
      tracks as unknown as Repository<Track>,
      justification as unknown as TrackJustificationService,
      userRoadmaps as unknown as UserRoadmapService,
    );
  });

  function draft(): RoadmapDraft {
    return userRoadmaps.createFrom.mock.calls[0][1] as RoadmapDraft;
  }

  it('recorta a trilha, reindexa a ordem e devolve o roadmap persistido', async () => {
    const result = await service.generate(userId, answers);

    expect(result).toBe(persisted);
    expect(tracks.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'frontend' } }),
    );
    expect(userRoadmaps.createFrom).toHaveBeenCalledWith(
      userId,
      expect.anything(),
    );

    const created = draft();
    expect(created.targetArea).toBe('frontend');
    expect(created.trackSlug).toBe('frontend');
    expect(created.justification).toBe('porque sim');
    // 5h: o módulo só de opcionais some, e "JavaScript" passa de 2 para 1.
    expect(created.modules.map((m) => [m.title, m.order])).toEqual([
      ['Fundamentos', 0],
      ['JavaScript', 1],
    ]);
    expect(
      created.modules[0].topics.map((t) => [t.trackTopicId, t.order]),
    ).toEqual([
      ['html', 0],
      ['css', 1],
    ]);
  });

  it('tópico de habilidade dominada nasce concluído; os demais, não', async () => {
    await service.generate(userId, answers);

    const [html, css] = draft().modules[0].topics;
    expect(html.isCompleted).toBe(true);
    expect(css.isCompleted).toBe(false);
  });

  it('copia os recursos da trilha na ordem de relevância', async () => {
    await service.generate(userId, answers);

    expect(draft().modules[0].topics[1].resources).toEqual([
      {
        title: 'Aula',
        url: 'https://youtu.be/css',
        type: 'video',
        source: 'youtube',
        thumbnailUrl: 'https://i.ytimg.com/css.jpg',
      },
      {
        title: 'Artigo',
        url: 'https://mdn.dev/css',
        type: 'article',
        source: 'web',
      },
    ]);
  });

  it('entrega à justificativa os números do recorte, não os da trilha inteira', async () => {
    await service.generate(userId, answers);

    expect(justification.write).toHaveBeenCalledWith(
      expect.objectContaining({ area: 'frontend' }),
      {
        area: 'frontend',
        areaChosenByUser: true,
        moduleCount: 2,
        topicCount: 3,
        knownTopicCount: 1,
      },
    );
  });

  it('"ainda não sei" decide pela afinidade e a guarda nas respostas', async () => {
    await service.generate(userId, {
      ...answers,
      area: 'nao-sei',
      affinity: 'infra',
    });

    expect(tracks.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'devops' } }),
    );
    expect(draft().answers?.affinity).toBe('infra');
    expect(justification.write.mock.calls[0][1]).toMatchObject({
      areaChosenByUser: false,
    });
  });

  it('descarta a afinidade de quem já escolheu a área', async () => {
    await service.generate(userId, { ...answers, affinity: 'logica' });

    expect(draft().answers).toEqual(answers);
  });

  it('responde 503 e não cria nada se a trilha não está no banco', async () => {
    tracks.findOne.mockResolvedValue(null);

    await expect(service.generate(userId, answers)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(userRoadmaps.createFrom).not.toHaveBeenCalled();
  });
});
