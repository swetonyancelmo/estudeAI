import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { RoadmapResponseDto, WizardAnswers } from '@estudeai/shared-types';
import { RoadmapTemplate } from './entities/roadmap-template.entity';

/** Código de erro do Postgres para violação de unique_violation. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Cache de roadmaps pré-gerados (FR-02.2) — responsabilidade única: ler e
 * gravar templates por match EXATO dos 4 critérios do wizard. Isolado do
 * RoadmapAiService (CLAUDE.md §6): o RoadmapService orquestra os dois.
 */
@Injectable()
export class RoadmapCacheService {
  private readonly logger = new Logger(RoadmapCacheService.name);

  constructor(
    @InjectRepository(RoadmapTemplate)
    private readonly templates: Repository<RoadmapTemplate>,
  ) {}

  /** Retorna o roadmap em cache para os critérios exatos, ou null (miss). */
  async find(answers: WizardAnswers): Promise<RoadmapResponseDto | null> {
    const template = await this.templates.findOne({
      where: {
        goal: answers.goal,
        weeklyTime: answers.weeklyTime,
        affinity: answers.affinity,
        learningStyle: answers.learningStyle,
      },
    });
    return template ? template.payload : null;
  }

  /**
   * Grava o roadmap gerado como novo template para os critérios usados. Tolera
   * corrida: se dois cache miss simultâneos com os mesmos critérios tentarem
   * inserir, o segundo viola o índice único (23505) — logamos e seguimos, pois
   * o roadmap já foi gerado e será devolvido ao chamador de qualquer forma.
   */
  async save(
    answers: WizardAnswers,
    roadmap: RoadmapResponseDto,
  ): Promise<void> {
    try {
      await this.templates.save(
        this.templates.create({
          goal: answers.goal,
          weeklyTime: answers.weeklyTime,
          affinity: answers.affinity,
          learningStyle: answers.learningStyle,
          payload: roadmap,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.logger.debug(
          `Template já existia para ${this.keyOf(answers)} (corrida) — ignorando.`,
        );
        return;
      }
      throw error;
    }
  }

  /** Serializa os 4 critérios para uso em logs. */
  keyOf(answers: WizardAnswers): string {
    return `${answers.goal}/${answers.weeklyTime}/${answers.affinity}/${answers.learningStyle}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as { code?: string }).code === PG_UNIQUE_VIOLATION
    );
  }
}
