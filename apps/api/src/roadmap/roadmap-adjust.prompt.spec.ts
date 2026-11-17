import type { RoadmapDetailDto } from '@estudeai/shared-types';
import { buildAdjustUserPrompt } from './roadmap-adjust.prompt';

describe('buildAdjustUserPrompt', () => {
  const roadmap = {
    targetArea: 'frontend',
    progress: { completedTopics: 0, totalTopics: 2, percent: 0 },
    modules: [
      {
        id: 'm-1',
        title: 'Fundamentos',
        description: 'A base.',
        topics: [
          { id: 't-1', kind: 'topic', title: 'HTML', isCompleted: false },
          {
            id: 't-2',
            kind: 'project',
            title: 'Página pessoal',
            description: 'Construa a sua página.',
            isCompleted: false,
            estimatedHours: 8,
          },
        ],
      },
    ],
  } as unknown as RoadmapDetailDto;

  it('marca só os projetos com kind, para a IA mantê-los no fim do módulo', () => {
    const prompt = buildAdjustUserPrompt(roadmap, 'tenho menos tempo');
    const snapshot = JSON.parse(prompt.split('\n')[1]) as {
      modules: { topics: Record<string, unknown>[] }[];
    };

    const [topic, project] = snapshot.modules[0].topics;
    expect(topic).not.toHaveProperty('kind');
    expect(project.kind).toBe('project');
    // A descrição do projeto não vai: a IA não a devolve, então não a reescreve.
    expect(project).not.toHaveProperty('description');
  });
});
