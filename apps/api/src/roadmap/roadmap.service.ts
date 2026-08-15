import { Injectable, Logger } from '@nestjs/common';
import type { RoadmapDetailDto, WizardAnswers } from '@estudeai/shared-types';
import { RoadmapAiService } from './roadmap-ai.service';
import { RoadmapCacheService } from './roadmap-cache.service';
import { ResourceDiscoveryService } from './resource-discovery.service';
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
 *
 * Etapa 8: a descoberta de recursos acontece ANTES do `cache.save`, então os
 * links são cacheados junto do template e um HIT não rebusca nada — o custo em
 * cota do YouTube fica limitado ao número de combinações do wizard, não ao
 * número de usuários.
 */
@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    private readonly cache: RoadmapCacheService,
    private readonly aiService: RoadmapAiService,
    private readonly resources: ResourceDiscoveryService,
    private readonly userRoadmaps: UserRoadmapService,
  ) {}

  async generate(
    userId: string,
    answers: WizardAnswers,
  ): Promise<RoadmapDetailDto> {
    const cached = await this.cache.find(answers);
    if (cached) {
      this.logger.log(`cache HIT — ${this.cache.keyOf(answers)}`);

      // Backfill preguiçoso: templates gravados antes da Etapa 8 (ou cuja
      // descoberta parou no meio pelo orçamento de tempo) ganham os recursos
      // no primeiro hit, e a partir daí o HIT volta a custar zero chamadas.
      if (!this.hasAllResources(cached)) {
        this.logger.log(
          'Template sem recursos — enriquecendo antes de copiar.',
        );
        const enriched = await this.resources.enrichRoadmap(cached);
        await this.cache.refresh(answers, enriched);
        return this.userRoadmaps.createFrom(userId, enriched);
      }

      return this.userRoadmaps.createFrom(userId, cached);
    }

    this.logger.log(
      `cache MISS — ${this.cache.keyOf(answers)} — chamando Gemini`,
    );
    const roadmap = await this.aiService.generate(answers);
    const enriched = await this.resources.enrichRoadmap(roadmap);
    await this.cache.save(answers, enriched);
    return this.userRoadmaps.createFrom(userId, enriched);
  }

  /**
   * `resources` ausente = nunca buscado (template antigo ou tópico cortado pelo
   * orçamento). Array vazio conta como resolvido: já buscamos e não sobrou link
   * válido — insistir só gastaria cota.
   */
  private hasAllResources(roadmap: {
    modules: { topics: { resources?: unknown[] }[] }[];
  }): boolean {
    return roadmap.modules.every((module) =>
      module.topics.every((topic) => topic.resources !== undefined),
    );
  }
}
