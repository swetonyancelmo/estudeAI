import { Injectable, Logger } from '@nestjs/common';
import type { AdjustRoadmapResponseDto } from '@estudeai/shared-types';
import { RoadmapAiService } from './roadmap-ai.service';
import { UserRoadmapService } from './user-roadmap.service';
import {
  AdjustmentIntegrityError,
  buildAdjustmentPlan,
} from './roadmap-adjust.validator';

/**
 * FR-04 — orquestra o reajuste do roadmap ativo. Mesmo papel do RoadmapService
 * na geração, com uma ausência importante: **o cache (Etapa 5) não entra aqui**.
 * `RoadmapTemplate` é molde genérico por critério de wizard, compartilhado entre
 * usuários e sem progresso; este roadmap já é individual e tem progresso. Buscar
 * ou gravar cache no reajuste vazaria o roadmap de um usuário para outro.
 *
 * A ordem dos passos é a garantia de "nada é persistido se a IA trapacear":
 * ownership → IA → validação de integridade → persistência. O terceiro passo
 * lança 422 antes de qualquer escrita.
 */
@Injectable()
export class RoadmapAdjustService {
  private readonly logger = new Logger(RoadmapAdjustService.name);

  constructor(
    private readonly aiService: RoadmapAiService,
    private readonly userRoadmaps: UserRoadmapService,
  ) {}

  async adjust(
    userId: string,
    roadmapId: string,
    adjustmentRequest: string,
  ): Promise<AdjustRoadmapResponseDto> {
    // 404 se não existe, 403 se é de outro usuário (mesma regra da Etapa 6).
    const current = await this.userRoadmaps.findDetail(userId, roadmapId);

    const adjusted = await this.aiService.adjustRoadmap(
      current,
      adjustmentRequest,
    );

    // Fail-fast: valida ANTES de abrir transação. O plano definitivo é
    // reconstruído dentro do applyAdjustment, contra o estado recém-lido —
    // esta primeira passada existe para rejeitar cedo e para deixar explícito
    // que nenhuma escrita acontece com uma resposta suspeita.
    try {
      buildAdjustmentPlan(current, adjusted);
    } catch (error) {
      if (error instanceof AdjustmentIntegrityError) {
        this.logger.warn(
          `Reajuste rejeitado (roadmap ${roadmapId}): ${error.violation}`,
        );
      }
      throw error;
    }

    return this.userRoadmaps.applyAdjustment(userId, roadmapId, adjusted);
  }
}
