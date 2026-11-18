import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { TrackQuizQuestion } from '../tracks/entities/track-quiz-question.entity';
import type { Topic } from './entities/topic.entity';
import { QuizService } from './quiz.service';
import type { UserRoadmapService } from './user-roadmap.service';

const USER = 'user-1';

function question(id: string, answerIndex = 1): TrackQuizQuestion {
  return {
    id,
    trackTopicId: 'track-topic-1',
    slug: id,
    question: `Pergunta ${id}?`,
    options: ['A', 'B', 'C', 'D'],
    answerIndex,
    explanation: `Explicação de ${id}.`,
    order: 0,
  } as TrackQuizQuestion;
}

describe('QuizService (Fase 3)', () => {
  let topic: Partial<Topic>;
  let userRoadmaps: { loadOwnedTopic: jest.Mock };
  let questions: { find: jest.Mock };
  let attempts: { insert: jest.Mock; query: jest.Mock };
  let service: QuizService;

  beforeEach(() => {
    topic = { id: 'topic-1', trackTopicId: 'track-topic-1' };
    userRoadmaps = { loadOwnedTopic: jest.fn(() => Promise.resolve(topic)) };
    questions = {
      find: jest.fn().mockResolvedValue([question('q1'), question('q2', 3)]),
    };
    attempts = {
      insert: jest.fn().mockResolvedValue(undefined),
      query: jest.fn().mockResolvedValue([]),
    };
    service = new QuizService(
      userRoadmaps as unknown as UserRoadmapService,
      questions as never,
      attempts as never,
    );
  });

  describe('getQuiz', () => {
    it('devolve perguntas e alternativas, nunca o gabarito nem a explicação', async () => {
      const quiz = await service.getQuiz(USER, 'roadmap-1', 'topic-1');

      expect(quiz).toEqual({
        topicId: 'topic-1',
        questions: [
          { id: 'q1', question: 'Pergunta q1?', options: ['A', 'B', 'C', 'D'] },
          { id: 'q2', question: 'Pergunta q2?', options: ['A', 'B', 'C', 'D'] },
        ],
        summary: null,
      });
      expect(JSON.stringify(quiz)).not.toMatch(/answerIndex|Explicação/);
      expect(questions.find).toHaveBeenCalledWith({
        where: { trackTopicId: 'track-topic-1' },
        order: { order: 'ASC' },
      });
    });

    it('resume pela última resposta de cada pergunta', async () => {
      attempts.query.mockResolvedValue([
        { is_correct: true, created_at: new Date('2026-11-17T10:00:00Z') },
        { is_correct: false, created_at: new Date('2026-11-17T10:05:00Z') },
      ]);

      const quiz = await service.getQuiz(USER, 'roadmap-1', 'topic-1');

      expect(quiz.summary).toEqual({
        total: 2,
        answered: 2,
        correct: 1,
        lastAnsweredAt: '2026-11-17T10:05:00.000Z',
      });
      expect(attempts.query).toHaveBeenCalledWith(
        expect.stringContaining('DISTINCT ON ("question_id")'),
        ['topic-1', ['q1', 'q2']],
      );
    });

    it('tópico sem tópico de trilha (projeto, reajuste) não tem quiz', async () => {
      topic.trackTopicId = null;

      const quiz = await service.getQuiz(USER, 'roadmap-1', 'topic-1');

      expect(quiz.questions).toEqual([]);
      expect(quiz.summary).toBeNull();
      expect(questions.find).not.toHaveBeenCalled();
    });

    it('propaga a checagem de dono (403/404) sem consultar perguntas', async () => {
      userRoadmaps.loadOwnedTopic.mockRejectedValue(new ForbiddenException());

      await expect(
        service.getQuiz('intruso', 'roadmap-1', 'topic-1'),
      ).rejects.toThrow(ForbiddenException);
      expect(questions.find).not.toHaveBeenCalled();
    });
  });

  describe('answer', () => {
    it('acerto: grava a tentativa e revela gabarito e explicação', async () => {
      attempts.query.mockResolvedValue([
        { is_correct: true, created_at: new Date('2026-11-17T10:00:00Z') },
      ]);

      const result = await service.answer(USER, 'roadmap-1', 'topic-1', {
        questionId: 'q2',
        chosenIndex: 3,
      });

      expect(attempts.insert).toHaveBeenCalledWith({
        userId: USER,
        roadmapTopicId: 'topic-1',
        questionId: 'q2',
        chosenIndex: 3,
        isCorrect: true,
      });
      expect(result).toEqual({
        questionId: 'q2',
        chosenIndex: 3,
        correct: true,
        answerIndex: 3,
        explanation: 'Explicação de q2.',
        summary: {
          total: 2,
          answered: 1,
          correct: 1,
          lastAnsweredAt: '2026-11-17T10:00:00.000Z',
        },
      });
    });

    it('erro: grava como incorreta e mostra a certa', async () => {
      attempts.query.mockResolvedValue([
        { is_correct: false, created_at: new Date() },
      ]);

      const result = await service.answer(USER, 'roadmap-1', 'topic-1', {
        questionId: 'q1',
        chosenIndex: 0,
      });

      expect(result.correct).toBe(false);
      expect(result.answerIndex).toBe(1);
      expect(attempts.insert).toHaveBeenCalledWith(
        expect.objectContaining({ isCorrect: false }),
      );
    });

    it('pergunta de outro tópico: 404 e nada gravado', async () => {
      await expect(
        service.answer(USER, 'roadmap-1', 'topic-1', {
          questionId: 'pergunta-de-outro-topico',
          chosenIndex: 0,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(attempts.insert).not.toHaveBeenCalled();
    });

    it('alternativa além das que a pergunta tem: 400', async () => {
      questions.find.mockResolvedValue([
        { ...question('q1'), options: ['A', 'B'] },
      ]);

      await expect(
        service.answer(USER, 'roadmap-1', 'topic-1', {
          questionId: 'q1',
          chosenIndex: 3,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(attempts.insert).not.toHaveBeenCalled();
    });
  });
});
