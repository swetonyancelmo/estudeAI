import {
  addDays,
  isPlausibleToday,
  isValidDay,
  isValidTimeZone,
  localDay,
  mondayOf,
  pace,
  streaks,
  weekly,
} from './study-stats';

describe('study-stats (Fase 5)', () => {
  it.each([
    ['2026-11-18', true],
    ['2026-02-29', false],
    ['2026-13-01', false],
    ['18/11/2026', false],
    ['', false],
  ])('isValidDay(%s) = %s', (day, expected) => {
    expect(isValidDay(day)).toBe(expected);
  });

  it('addDays e mondayOf atravessam mês e ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(mondayOf('2026-11-18')).toBe('2026-11-16'); // quarta
    expect(mondayOf('2026-11-16')).toBe('2026-11-16'); // segunda
    expect(mondayOf('2026-11-22')).toBe('2026-11-16'); // domingo
  });

  it('isPlausibleToday aceita só ±1 dia do UTC do servidor', () => {
    const now = new Date('2026-11-18T02:00:00Z'); // ainda dia 17 em São Paulo
    expect(isPlausibleToday('2026-11-17', now)).toBe(true);
    expect(isPlausibleToday('2026-11-19', now)).toBe(true);
    expect(isPlausibleToday('2026-11-15', now)).toBe(false);
    expect(isPlausibleToday('ontem', now)).toBe(false);
  });

  it('localDay converte o instante para o dia do fuso', () => {
    const instant = new Date('2026-11-18T02:00:00Z');
    expect(localDay(instant, 'America/Sao_Paulo')).toBe('2026-11-17');
    expect(localDay(instant, 'UTC')).toBe('2026-11-18');
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('Marte/Olympus')).toBe(false);
  });

  describe('streaks', () => {
    const today = '2026-11-18';

    it('conta até hoje', () => {
      expect(
        streaks(['2026-11-16', '2026-11-17', '2026-11-18'], today).current,
      ).toBe(3);
    });

    it('sem estudo hoje, conta até ontem', () => {
      expect(streaks(['2026-11-16', '2026-11-17'], today).current).toBe(2);
    });

    it('sem estudo ontem nem hoje, a sequência é 0', () => {
      expect(streaks(['2026-11-15', '2026-11-16'], today).current).toBe(0);
    });

    it('melhor sequência é a maior já feita', () => {
      expect(
        streaks(
          [
            '2026-11-01',
            '2026-11-02',
            '2026-11-03',
            '2026-11-04',
            '2026-11-10',
            '2026-11-18',
          ],
          today,
        ),
      ).toEqual({ current: 1, best: 4 });
    });

    it('sem nenhum dia', () => {
      expect(streaks([], today)).toEqual({ current: 0, best: 0 });
    });
  });

  it('weekly agrupa por semana de segunda a domingo, da mais antiga à atual', () => {
    const minutes = new Map([
      ['2026-11-16', 30], // semana atual (segunda)
      ['2026-11-18', 15], // semana atual (quarta)
      ['2026-11-15', 60], // domingo: semana anterior
      ['2026-09-01', 99], // fora das 3 semanas
    ]);
    const weeks = weekly(
      '2026-11-18',
      minutes,
      ['2026-11-17', '2026-11-09'],
      3,
    );

    expect(weeks).toEqual([
      { weekStart: '2026-11-02', minutes: 0, topicsCompleted: 0 },
      { weekStart: '2026-11-09', minutes: 60, topicsCompleted: 1 },
      { weekStart: '2026-11-16', minutes: 45, topicsCompleted: 1 },
    ]);
  });

  describe('pace', () => {
    const weeks = (...minutes: number[]) =>
      minutes.map((m) => ({ minutes: m }));

    it('média das últimas 4 semanas e semanas restantes', () => {
      expect(pace(weeks(999, 0, 120, 240, 240), 20)).toEqual({
        recentWeeklyMinutes: 150,
        weeksAtRecentPace: 8, // 1200 min / 150 por semana
      });
    });

    it('sem estudo recente não há previsão', () => {
      expect(pace(weeks(300, 0, 0, 0, 0), 20).weeksAtRecentPace).toBeNull();
    });

    it('nada restante: 0 semanas', () => {
      expect(pace(weeks(60, 60, 60, 60), 0).weeksAtRecentPace).toBe(0);
    });
  });
});
