import { Injectable, Logger } from '@nestjs/common';
import type { RoadmapDetailDto, WizardAnswers } from '@estudeai/shared-types';
import { RoadmapAiService } from './roadmap-ai.service';
import { RoadmapCacheService } from './roadmap-cache.service';
import { UserRoadmapService } from './user-roadmap.service';

/**
 * Camada de orquestração isolada (CLAUDE.md §6): o controller nunca chama a
 * geração direto. O cache (FR-02.2) entra AQUI, ANTES do AI:
 *  - HIT: devolve o template em cache, sem chamar o Gemini.
 *  - MISS: chama o RoadmapAiService (Etapa 4) e grava o resultado como novo
 *    template, pra próxima requisição com os mesmos critérios pegar do cache.
 *
 * Etapa 6 (FR-03.2): venha de onde vier, o conteúdo obtido é apenas um MOLDE.
 * O último passo copia esse molde para as entidades do usuário — é o roadmap
 * persistido (com ids reais) que volta pro frontend, nunca o molde solto.
 */
@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    private readonly cache: RoadmapCacheService,
    private readonly aiService: RoadmapAiService,
    private readonly userRoadmaps: UserRoadmapService,
  ) {}

  async generate(
    userId: string,
    answers: WizardAnswers,
  ): Promise<RoadmapDetailDto> {
    const cached = await this.cache.find(answers);
    if (cached) {
      this.logger.log(`cache HIT — ${this.cache.keyOf(answers)}`);
      return this.userRoadmaps.createFrom(userId, cached);
    }

    this.logger.log(
      `cache MISS — ${this.cache.keyOf(answers)} — chamando Gemini`,
    );
    const roadmap = await this.aiService.generate(answers);
    await this.cache.save(answers, roadmap);
    return this.userRoadmaps.createFrom(userId, roadmap);
  }
}
