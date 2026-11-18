import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { ReviewService } from './review.service';
import { createScheduler, scheduleReview } from './review-scheduler';

const USER = 'user-1';
type Query = jest.Mock<Promise<unknown>, [string, unknown[]]>;

describe('ReviewService (Fase 6)', () => {
  let manager: { query: Query };
  let cards: { query: Query; findOne: jest.Mock };
  let questions: { findOne: jest.Mock };
  let attempts: { insert: jest.Mock };
  let service: ReviewService;

  beforeEach(() => {
    manager = { query: jest.fn<Promise<unknown>, [string, unknown[]]>() };
    const dataSource = {
      transaction: (work: (m: typeof manager) => Promise<unknown>) =>
        work(manager),
    } as unknown as DataSource;
    cards = {
      query: jest
        .fn<Promise<unknown>, [string, unknown[]]>()
        .mockResolvedValue([]),
      findOne: jest.fn(),
    };
    questions = { findOne: jest.fn() };
    attempts = { insert: jest.fn().mockResolvedValue(undefined) };
    service = new ReviewService(
      dataSource,
      cards as never,
      questions as never,
      attempts as never,
    );
  });

  describe('record', () => {
    it('cartão existente: trava a linha, agenda a partir dele e grava', async () => {
      const current = scheduleReview(
        createScheduler(false),
        null,
        true,
        new Date(),
      );
      manager.query.mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes('FOR UPDATE') ? [{ id: 'c1', card: current }] : [],
        ),
      );

      const due = await service.record(USER, 'topic-1', 'q1', true);

      const [selectSql] = manager.query.mock.calls[0];
      expect(selectSql).toContain('FOR UPDATE');
      const [upsertSql, params] = manager.query.mock.calls[1];
      expect(upsertSql).toContain(
        'ON CONFLICT ("user_id", "question_id") DO UPDATE',
      );
      expect(params.slice(0, 3)).toEqual([USER, 'q1', 'topic-1']);
      // Segundo acerto: bem mais longe que o primeiro intervalo.
      expect(due.getTime()).toBeGreaterThan(new Date(current.due).getTime());
    });

    it('sem cartão: monta o estado reaplicando o histórico da pergunta', async () => {
      const day = 86_400_000;
      const t0 = new Date(Date.now() - 10 * day);
      manager.query.mockImplementation((sql: string) => {
        if (sql.includes('FOR UPDATE')) return Promise.resolve([]);
        if (sql.includes('"quiz_attempts"')) {
          return Promise.resolve([
            { is_correct: false, created_at: t0 },
            { is_correct: true, created_at: new Date(t0.getTime() + 2 * day) },
          ]);
        }
        return Promise.resolve([]);
      });

      await service.record(USER, 'topic-1', 'q1', true);

      const upsert = manager.query.mock.calls.find(([sql]) =>
        sql.includes('INSERT INTO "review_cards"'),
      )!;
      const stored = JSON.parse(upsert[1][4] as string) as {
        reps: number;
        lapses: number;
      };
      expect(stored.reps).toBe(2);
      expect(stored.lapses).toBe(0); // o erro foi a 1ª resposta, antes de aprender
    });
  });

  describe('queue', () => {
    it('cria cartões que faltam e devolve a fila sem o gabarito', async () => {
      cards.query.mockImplementation((sql: string) => {
        if (sql.includes('LEFT JOIN "review_cards"')) {
          return Promise.resolve([
            {
              question_id: 'q9',
              roadmap_topic_id: 'topic-9',
              answers: [{ correct: true, at: new Date().toISOString() }],
            },
          ]);
        }
        if (sql.includes('ORDER BY c."due"')) {
          return Promise.resolve([
            {
              card_id: 'c1',
              question_id: 'q1',
              question: 'Pergunta?',
              options: ['A', 'B', 'C', 'D'],
              topic_id: 't1',
              topic_title: 'HTTP',
              roadmap_id: 'r1',
            },
          ]);
        }
        if (sql.includes('"due_count"')) {
          return Promise.resolve([
            { due_count: '3', total: '10', next_due: null },
          ]);
        }
        return Promise.resolve([]);
      });

      const queue = await service.queue(USER);

      const backfill = cards.query.mock.calls.find(([sql]) =>
        sql.includes('ON CONFLICT ("user_id", "question_id") DO NOTHING'),
      );
      expect(backfill?.[1].slice(0, 3)).toEqual([USER, 'q9', 'topic-9']);
      expect(queue).toEqual({
        dueCount: 3,
        totalCards: 10,
        nextDueAt: null,
        items: [
          {
            cardId: 'c1',
            question: {
              id: 'q1',
              question: 'Pergunta?',
              options: ['A', 'B', 'C', 'D'],
            },
            topic: { id: 't1', title: 'HTTP', roadmapId: 'r1' },
          },
        ],
      });
      expect(JSON.stringify(queue)).not.toMatch(/answer|explanation/i);
    });
  });

  describe('answer', () => {
    const card = {
      id: 'c1',
      userId: USER,
      questionId: 'q1',
      roadmapTopicId: 't1',
    };
    const question = {
      id: 'q1',
      options: ['A', 'B', 'C', 'D'],
      answerIndex: 2,
      explanation: 'Porque C.',
    };

    it('corrige, grava a tentativa no tópico de origem e agenda', async () => {
      cards.findOne.mockResolvedValue(card);
      questions.findOne.mockResolvedValue(question);
      const record = jest
        .spyOn(service, 'record')
        .mockResolvedValue(new Date('2026-11-21T12:00:00Z'));

      const result = await service.answer(USER, 'c1', 2);

      expect(attempts.insert).toHaveBeenCalledWith({
        userId: USER,
        roadmapTopicId: 't1',
        questionId: 'q1',
        chosenIndex: 2,
        isCorrect: true,
      });
      expect(record).toHaveBeenCalledWith(USER, 't1', 'q1', true);
      expect(result).toEqual({
        cardId: 'c1',
        chosenIndex: 2,
        correct: true,
        answerIndex: 2,
        explanation: 'Porque C.',
        nextReviewAt: '2026-11-21T12:00:00.000Z',
      });
    });

    it('cartão de outra pessoa responde como inexistente', async () => {
      cards.findOne.mockResolvedValue({ ...card, userId: 'outra' });

      await expect(service.answer(USER, 'c1', 0)).rejects.toThrow(
        NotFoundException,
      );
      expect(attempts.insert).not.toHaveBeenCalled();
    });

    it('alternativa fora da pergunta: 400', async () => {
      cards.findOne.mockResolvedValue(card);
      questions.findOne.mockResolvedValue({ ...question, options: ['A', 'B'] });

      await expect(service.answer(USER, 'c1', 3)).rejects.toThrow(
        BadRequestException,
      );
      expect(attempts.insert).not.toHaveBeenCalled();
    });
  });
});
