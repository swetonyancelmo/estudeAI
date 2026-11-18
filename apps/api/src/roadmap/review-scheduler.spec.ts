import {
  createScheduler,
  replayAnswers,
  scheduleReview,
  type StoredCard,
} from './review-scheduler';

const DAY = 86_400_000;
const start = new Date('2026-11-18T12:00:00Z');
const daysUntil = (card: StoredCard, from: Date) =>
  Math.round((new Date(card.due).getTime() - from.getTime()) / DAY);

describe('review-scheduler (Fase 6)', () => {
  const scheduler = createScheduler(false); // sem sorteio: resultado exato

  it('acertos seguidos empurram a revisão para cada vez mais longe', () => {
    const first = scheduleReview(scheduler, null, true, start);
    const second = scheduleReview(scheduler, first, true, new Date(first.due));
    const third = scheduleReview(scheduler, second, true, new Date(second.due));

    expect(daysUntil(first, start)).toBe(3);
    expect(daysUntil(second, new Date(first.due))).toBe(14);
    expect(daysUntil(third, new Date(second.due))).toBeGreaterThan(14);
  });

  it('erro traz a pergunta de volta no dia seguinte e conta o lapso', () => {
    const learned = scheduleReview(scheduler, null, true, start);
    const forgot = scheduleReview(
      scheduler,
      learned,
      false,
      new Date(learned.due),
    );

    expect(daysUntil(forgot, new Date(learned.due))).toBe(1);
    expect(forgot.lapses).toBe(1);
    expect(forgot.reps).toBe(2);
  });

  it('nunca agenda em minutos (sem passos curtos)', () => {
    const wrong = scheduleReview(scheduler, null, false, start);
    expect(
      new Date(wrong.due).getTime() - start.getTime(),
    ).toBeGreaterThanOrEqual(DAY);
  });

  it('o cartão guardado é JSON puro e volta ao mesmo estado', () => {
    const card = scheduleReview(scheduler, null, true, start);
    const roundTrip = JSON.parse(JSON.stringify(card)) as StoredCard;
    expect(
      scheduleReview(scheduler, roundTrip, true, new Date(card.due)),
    ).toEqual(scheduleReview(scheduler, card, true, new Date(card.due)));
  });

  it('replayAnswers aplica o histórico em ordem cronológica', () => {
    const answers = [
      { correct: true, answeredAt: new Date(start.getTime() + 5 * DAY) },
      { correct: false, answeredAt: start },
    ];
    const replayed = replayAnswers(scheduler, answers)!;
    const manual = scheduleReview(
      scheduler,
      scheduleReview(scheduler, null, false, start),
      true,
      new Date(start.getTime() + 5 * DAY),
    );
    expect(replayed).toEqual(manual);
    expect(replayAnswers(scheduler, [])).toBeNull();
  });

  it('com sorteio, o intervalo fica perto do exato', () => {
    const fuzzy = createScheduler(true);
    const card = scheduleReview(scheduler, null, true, start);
    const second = scheduleReview(fuzzy, card, true, new Date(card.due));
    const days = daysUntil(second, new Date(card.due));
    expect(days).toBeGreaterThanOrEqual(11);
    expect(days).toBeLessThanOrEqual(17);
  });
});
