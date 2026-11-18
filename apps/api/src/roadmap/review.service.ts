import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  REVIEW_SESSION_SIZE,
  type ReviewAnswerResultDto,
  type ReviewQueueDto,
} from '@estudeai/shared-types';
import { TrackQuizQuestion } from '../tracks/entities/track-quiz-question.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { ReviewCard } from './entities/review-card.entity';
import {
  createScheduler,
  replayAnswers,
  scheduleReview,
  type StoredCard,
} from './review-scheduler';

interface MissingCardRow {
  question_id: string;
  roadmap_topic_id: string;
  answers: { correct: boolean; at: string }[];
}

interface QueueRow {
  card_id: string;
  question_id: string;
  question: string;
  options: string[];
  topic_id: string;
  topic_title: string;
  roadmap_id: string;
}

interface CountsRow {
  due_count: string;
  total: string;
  next_due: Date | null;
}

/**
 * Revisão espaçada das perguntas de quiz (Fase 6).
 *
 * Toda resposta de quiz — no tópico ou aqui — passa por `record`, que agenda a
 * próxima revisão da pergunta para a pessoa. A fila do dia são os cartões com
 * revisão vencida; responder na revisão grava em `quiz_attempts` como no quiz,
 * então o resumo do tópico e o painel de evolução enxergam as revisões.
 */
@Injectable()
export class ReviewService {
  private readonly scheduler = createScheduler(true);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(ReviewCard)
    private readonly cards: Repository<ReviewCard>,
    @InjectRepository(TrackQuizQuestion)
    private readonly questions: Repository<TrackQuizQuestion>,
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
  ) {}

  /**
   * Agenda a pergunta depois de uma resposta já gravada em `quiz_attempts`.
   * A linha do cartão fica travada (FOR UPDATE) durante o cálculo: o próximo
   * estado depende do anterior, e duas respostas simultâneas não podem
   * calcular a partir do mesmo ponto. Sem cartão, o estado vem do histórico
   * inteiro de respostas da pergunta (que já inclui a resposta nova).
   */
  async record(
    userId: string,
    roadmapTopicId: string,
    questionId: string,
    correct: boolean,
    answeredAt: Date = new Date(),
  ): Promise<Date> {
    return this.dataSource.transaction(async (manager) => {
      const locked: { id: string; card: StoredCard }[] = await manager.query(
        `SELECT "id", "card" FROM "review_cards"
          WHERE "user_id" = $1 AND "question_id" = $2 FOR UPDATE`,
        [userId, questionId],
      );
      const existing = locked[0];

      let next: StoredCard | null;
      if (existing) {
        next = scheduleReview(
          this.scheduler,
          existing.card,
          correct,
          answeredAt,
        );
      } else {
        const history: { is_correct: boolean; created_at: Date }[] =
          await manager.query(
            `SELECT "is_correct", "created_at" FROM "quiz_attempts"
            WHERE "user_id" = $1 AND "question_id" = $2`,
            [userId, questionId],
          );
        next =
          replayAnswers(
            this.scheduler,
            history.map((row) => ({
              correct: row.is_correct,
              answeredAt: new Date(row.created_at),
            })),
          ) ?? scheduleReview(this.scheduler, null, correct, answeredAt);
      }

      await manager.query(
        `INSERT INTO "review_cards" ("user_id", "question_id", "roadmap_topic_id", "due", "card")
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT ("user_id", "question_id") DO UPDATE SET
           "due" = EXCLUDED."due",
           "card" = EXCLUDED."card",
           "roadmap_topic_id" = EXCLUDED."roadmap_topic_id",
           "updated_at" = now()`,
        [userId, questionId, roadmapTopicId, next.due, JSON.stringify(next)],
      );
      return new Date(next.due);
    });
  }

  async queue(userId: string): Promise<ReviewQueueDto> {
    await this.ensureCards(userId);

    const rows: QueueRow[] = await this.cards.query(
      `SELECT c."id" AS "card_id", q."id" AS "question_id", q."question", q."options",
              t."id" AS "topic_id", t."title" AS "topic_title", m."roadmap_id"
         FROM "review_cards" c
         JOIN "track_quiz_questions" q ON q."id" = c."question_id"
         JOIN "roadmap_topics" t ON t."id" = c."roadmap_topic_id"
         JOIN "roadmap_modules" m ON m."id" = t."module_id"
        WHERE c."user_id" = $1 AND c."due" <= now()
        ORDER BY c."due"
        LIMIT $2`,
      [userId, REVIEW_SESSION_SIZE],
    );
    const countRows: CountsRow[] = await this.cards.query(
      `SELECT count(*) FILTER (WHERE "due" <= now()) AS "due_count",
              count(*) AS "total",
              min("due") FILTER (WHERE "due" > now()) AS "next_due"
         FROM "review_cards" WHERE "user_id" = $1`,
      [userId],
    );
    const counts = countRows[0];

    return {
      dueCount: Number(counts?.due_count ?? 0),
      totalCards: Number(counts?.total ?? 0),
      nextDueAt: counts?.next_due
        ? new Date(counts.next_due).toISOString()
        : null,
      items: rows.map((row) => ({
        cardId: row.card_id,
        question: {
          id: row.question_id,
          question: row.question,
          options: row.options,
        },
        topic: {
          id: row.topic_id,
          title: row.topic_title,
          roadmapId: row.roadmap_id,
        },
      })),
    };
  }

  async answer(
    userId: string,
    cardId: string,
    chosenIndex: number,
  ): Promise<ReviewAnswerResultDto> {
    const card = await this.cards.findOne({ where: { id: cardId } });
    // Cartão de outra pessoa responde igual a inexistente: não revela que existe.
    if (!card || card.userId !== userId) {
      throw new NotFoundException('Revisão não encontrada.');
    }
    const question = await this.questions.findOne({
      where: { id: card.questionId },
    });
    if (!question) {
      throw new NotFoundException('Pergunta não encontrada.');
    }
    if (chosenIndex >= question.options.length) {
      throw new BadRequestException('Alternativa inválida.');
    }

    const correct = chosenIndex === question.answerIndex;
    await this.attempts.insert({
      userId,
      roadmapTopicId: card.roadmapTopicId,
      questionId: question.id,
      chosenIndex,
      isCorrect: correct,
    });
    const nextReviewAt = await this.record(
      userId,
      card.roadmapTopicId,
      question.id,
      correct,
    );

    return {
      cardId: card.id,
      chosenIndex,
      correct,
      answerIndex: question.answerIndex,
      explanation: question.explanation,
      nextReviewAt: nextReviewAt.toISOString(),
    };
  }

  /**
   * Cria, de uma vez, os cartões das perguntas que a pessoa já respondeu e
   * ainda não têm cartão (quem respondia quizzes antes desta fase), reaplicando
   * o histórico de cada uma. Idempotente: ON CONFLICT DO NOTHING.
   */
  private async ensureCards(userId: string): Promise<void> {
    const missing: MissingCardRow[] = await this.cards.query(
      `SELECT a."question_id",
              (array_agg(a."roadmap_topic_id" ORDER BY a."created_at" DESC))[1] AS "roadmap_topic_id",
              json_agg(json_build_object('correct', a."is_correct", 'at', a."created_at")
                       ORDER BY a."created_at") AS "answers"
         FROM "quiz_attempts" a
         LEFT JOIN "review_cards" c
           ON c."user_id" = a."user_id" AND c."question_id" = a."question_id"
        WHERE a."user_id" = $1 AND c."id" IS NULL
        GROUP BY a."question_id"`,
      [userId],
    );
    for (const row of missing) {
      const card = replayAnswers(
        this.scheduler,
        row.answers.map((answer) => ({
          correct: answer.correct,
          answeredAt: new Date(answer.at),
        })),
      );
      if (!card) continue;
      await this.cards.query(
        `INSERT INTO "review_cards" ("user_id", "question_id", "roadmap_topic_id", "due", "card")
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT ("user_id", "question_id") DO NOTHING`,
        [
          userId,
          row.question_id,
          row.roadmap_topic_id,
          card.due,
          JSON.stringify(card),
        ],
      );
    }
  }
}
