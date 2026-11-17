import type {
  Affinity,
  LearningGoal,
  TargetArea,
} from '@estudeai/shared-types';
import { chooseTrack } from './track-selection';

describe('chooseTrack', () => {
  it.each<[TargetArea]>([['frontend'], ['backend'], ['fullstack'], ['devops']])(
    'quem escolheu %s fica com ela, seja qual for o resto',
    (area) => {
      expect(chooseTrack({ area, goal: 'startup', affinity: 'infra' })).toBe(
        area,
      );
    },
  );

  // A tabela inteira de docs/TRILHAS.md §4.
  it.each<[Affinity, LearningGoal, TargetArea]>([
    ['visual', 'mercado', 'frontend'],
    ['visual', 'startup', 'fullstack'],
    ['logica', 'mercado', 'backend'],
    ['logica', 'startup', 'fullstack'],
    ['infra', 'mercado', 'devops'],
    ['infra', 'startup', 'devops'],
  ])('"não sei" + %s + %s → %s', (affinity, goal, expected) => {
    expect(chooseTrack({ area: 'nao-sei', affinity, goal })).toBe(expected);
  });
});
