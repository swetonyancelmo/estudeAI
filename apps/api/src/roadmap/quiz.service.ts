import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  QuizAnswerResultDto,
  QuizDto,
  QuizSummaryDto,
  SubmitQuizAnswerRequestDto,
} from '@estudeai/shared-types';
import { TrackQuizQuestion } from '../tracks/entities/track-quiz-question.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import type { Topic } from './entities/topic.entity';
import { ReviewService } from './review.service';
import { UserRoadmapService } from './user-roadmap.service';

/** Linha da consulta da última resposta por pergunta (COUNT/ bool do pg). */
interface LatestAttemptRow {
  is_correct: boolean;
  created_at: Date;
}

/**
 * Quizzes da sala de estudo (Fase 3).
 *
 * As perguntas vêm do tópico da TRILHA de onde o tópico do usuário nasceu
 * (`trackTopicId`). Tópico sem essa ligação (projeto, ou assunto trocado num
 * reajuste) não tem quiz.
 *
 * O gabarito só sai daqui depois da resposta: `getQuiz` devolve pergunta e
 * alternativas, e `answer` corrige, grava a tentativa e só então revela a
 * alternativa certa e a explicação.
 */
@Injectable()
export class QuizService {
  constructor(
    private readonly userRoadmaps: UserRoadmapService,
    @InjectRepository(TrackQuizQuestion)
    private readonly questions: Repository<TrackQuizQuestion>,
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    private readonly review: ReviewService,
  ) {}

  async getQuiz(
    userId: string,
    roadmapId: string,
    topicId: string,
  ): Promise<QuizDto> {
    const topic = await this.userRoadmaps.loadOwnedTopic(
      userId,
      roadmapId,
      topicId,
    );
    const questions = await this.questionsOf(topic);
    return {
      topicId: topic.id,
      questions: questions.map((question) => ({
        id: question.id,
        question: question.question,
        options: question.options,
      })),
      summary: await this.summaryOf(topic.id, questions),
    };
  }

  async answer(
    userId: string,
    roadmapId: string,
    topicId: string,
    { questionId, chosenIndex }: SubmitQuizAnswerRequestDto,
  ): Promise<QuizAnswerResultDto> {
    const topic = await this.userRoadmaps.loadOwnedTopic(
      userId,
      roadmapId,
      topicId,
    );
    const questions = await this.questionsOf(topic);
    const question = questions.find((candidate) => candidate.id === questionId);
    if (!question) {
      throw new NotFoundException('Pergunta não encontrada neste tópico.');
    }
    if (chosenIndex >= question.options.length) {
      throw new BadRequestException('Alternativa inválida.');
    }

    const correct = chosenIndex === question.answerIndex;
    await this.attempts.insert({
      userId,
      roadmapTopicId: topic.id,
      questionId: question.id,
      chosenIndex,
      isCorrect: correct,
    });
    // Fase 6: toda resposta de quiz agenda a revisão espaçada da pergunta.
    await this.review.record(userId, topic.id, question.id, correct);

    const summary = await this.summaryOf(topic.id, questions);
    return {
      questionId: question.id,
      chosenIndex,
      correct,
      answerIndex: question.answerIndex,
      explanation: question.explanation,
      // Acabou de gravar uma resposta: nunca é nulo aqui.
      summary: summary!,
    };
  }

  private async questionsOf(topic: Topic): Promise<TrackQuizQuestion[]> {
    if (!topic.trackTopicId) return [];
    return this.questions.find({
      where: { trackTopicId: topic.trackTopicId },
      order: { order: 'ASC' },
    });
  }

  /**
   * Situação do quiz pela ÚLTIMA resposta de cada pergunta que ainda existe.
   * Refazer o quiz conta como nova chance, sem apagar o histórico.
   */
  private async summaryOf(
    roadmapTopicId: string,
    questions: TrackQuizQuestion[],
  ): Promise<QuizSummaryDto | null> {
    if (questions.length === 0) return null;

    const latest: LatestAttemptRow[] = await this.attempts.query(
      `SELECT DISTINCT ON ("question_id") "is_correct", "created_at"
         FROM "quiz_attempts"
        WHERE "roadmap_topic_id" = $1 AND "question_id" = ANY($2::uuid[])
        ORDER BY "question_id", "created_at" DESC`,
      [roadmapTopicId, questions.map((question) => question.id)],
    );
    if (latest.length === 0) return null;

    return {
      total: questions.length,
      answered: latest.length,
      correct: latest.filter((row) => row.is_correct).length,
      lastAnsweredAt: new Date(
        Math.max(...latest.map((row) => new Date(row.created_at).getTime())),
      ).toISOString(),
    };
  }
}
