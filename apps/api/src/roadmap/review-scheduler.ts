import { createEmptyCard, fsrs, Rating, type Card, type FSRS } from 'ts-fsrs';

/**
 * Agendamento da revisão espaçada (Fase 6), em volta do `ts-fsrs`.
 *
 * Só longo prazo (`enable_short_term: false`): os passos curtos do FSRS
 * (1 min, 10 min) são para flashcards na mesma sessão. Aqui a pergunta acabou
 * de ser respondida no quiz; ela volta em dias, não em minutos.
 */
export const REVIEW_RETENTION = 0.9;
export const REVIEW_MAX_INTERVAL_DAYS = 365;

/** Estado do cartão como fica no banco (jsonb): datas em ISO 8601. */
export type StoredCard = Omit<Card, 'due' | 'last_review'> & {
  due: string;
  last_review?: string;
};

export function createScheduler(fuzz = true): FSRS {
  return fsrs({
    request_retention: REVIEW_RETENTION,
    maximum_interval: REVIEW_MAX_INTERVAL_DAYS,
    enable_fuzz: fuzz,
    enable_short_term: false,
  });
}

export function toStored(card: Card): StoredCard {
  const { last_review: lastReview, due, ...rest } = card;
  return {
    ...rest,
    due: due.toISOString(),
    ...(lastReview ? { last_review: lastReview.toISOString() } : {}),
  };
}

function fromStored(stored: StoredCard): Card {
  return {
    ...stored,
    due: new Date(stored.due),
    ...(stored.last_review
      ? { last_review: new Date(stored.last_review) }
      : {}),
  } as Card;
}

/**
 * Próximo estado do cartão depois de uma resposta. Questão de múltipla
 * escolha corrigida automaticamente: acerto vale "Good", erro vale "Again".
 * `stored` nulo = primeira vez que a pessoa responde essa pergunta.
 */
export function scheduleReview(
  scheduler: FSRS,
  stored: StoredCard | null,
  correct: boolean,
  answeredAt: Date,
): StoredCard {
  const card = stored ? fromStored(stored) : createEmptyCard(answeredAt);
  const { card: next } = scheduler.next(
    card,
    answeredAt,
    correct ? Rating.Good : Rating.Again,
  );
  return toStored(next);
}

/**
 * Reaplica um histórico de respostas, em ordem, a partir de um cartão novo.
 * Usado para quem já respondia quizzes antes da revisão espaçada existir.
 */
export function replayAnswers(
  scheduler: FSRS,
  answers: { correct: boolean; answeredAt: Date }[],
): StoredCard | null {
  let stored: StoredCard | null = null;
  for (const answer of [...answers].sort(
    (a, b) => a.answeredAt.getTime() - b.answeredAt.getTime(),
  )) {
    stored = scheduleReview(
      scheduler,
      stored,
      answer.correct,
      answer.answeredAt,
    );
  }
  return stored;
}
