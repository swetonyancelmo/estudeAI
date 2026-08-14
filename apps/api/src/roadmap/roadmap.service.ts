import { Injectable, Logger } from '@nestjs/common';
import type { RoadmapResponseDto, WizardAnswers } from '@estudeai/shared-types';
import { RoadmapAiService } from './roadmap-ai.service';
import { RoadmapCacheService } from './roadmap-cache.service';

/**
 * Camada de orquestração isolada (CLAUDE.md §6): o controller nunca chama a
 * geração direto. O cache (FR-02.2) entra AQUI, ANTES do AI:
 *  - HIT: devolve o template em cache, sem chamar o Gemini.
 *  - MISS: chama o RoadmapAiService (Etapa 4) e grava o resultado como novo
 *    template, pra próxima requisição com os mesmos critérios pegar do cache.
 * O contrato (RoadmapResponseDto) é o mesmo venha de onde vier.
 */
@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    private readonly cache: RoadmapCacheService,
    private readonly aiService: RoadmapAiService,
  ) {}

  async generate(answers: WizardAnswers): Promise<RoadmapResponseDto> {
    const cached = await this.cache.find(answers);
    if (cached) {
      this.logger.log(`cache HIT — ${this.cache.keyOf(answers)}`);
      return cached;
    }

    this.logger.log(
      `cache MISS — ${this.cache.keyOf(answers)} — chamando Gemini`,
    );
    const roadmap = await this.aiService.generate(answers);
    await this.cache.save(answers, roadmap);
    return roadmap;
  }
}
