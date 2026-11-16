import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WizardAnswersDto } from './wizard-answers.dto';

const base = {
  goal: 'mercado',
  area: 'frontend',
  knownSkills: [],
  weeklyTime: '15h',
  learningStyle: 'pratico',
};

async function invalidFields(payload: Record<string, unknown>) {
  const errors = await validate(plainToInstance(WizardAnswersDto, payload));
  return errors.map((error) => error.property);
}

describe('WizardAnswersDto', () => {
  it('aceita área escolhida sem afinidade e sem habilidades', async () => {
    expect(await invalidFields(base)).toEqual([]);
  });

  it('exige afinidade de quem respondeu "ainda não sei"', async () => {
    expect(await invalidFields({ ...base, area: 'nao-sei' })).toEqual([
      'affinity',
    ]);
    expect(
      await invalidFields({ ...base, area: 'nao-sei', affinity: 'infra' }),
    ).toEqual([]);
  });

  it('recusa afinidade desconhecida mesmo quando ela não seria usada', async () => {
    expect(await invalidFields({ ...base, affinity: 'musica' })).toEqual([
      'affinity',
    ]);
  });

  it.each([
    ['fora do vocabulário', ['cobol']],
    ['repetida', ['git', 'git']],
    ['que não é lista', 'git'],
  ])('recusa habilidade %s', async (_label, knownSkills) => {
    expect(await invalidFields({ ...base, knownSkills })).toEqual([
      'knownSkills',
    ]);
  });

  it('recusa área que não existe', async () => {
    expect(await invalidFields({ ...base, area: 'mobile' })).toEqual(['area']);
  });
});
