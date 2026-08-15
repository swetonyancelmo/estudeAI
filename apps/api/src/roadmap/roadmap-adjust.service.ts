import { Injectable, Logger } from '@nestjs/common';
import type { AdjustRoadmapResponseDto } from '@estudeai/shared-types';
import { RoadmapAiService } from './roadmap-ai.service';
import { ResourceDiscoveryService } from './resource-discovery.service';
import {
  UserRoadmapService,
  type AppliedAdjustment,
} from './user-roadmap.service';
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
    private readonly resources: ResourceDiscoveryService,
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

    const applied = await this.userRoadmaps.applyAdjustment(
      userId,
      roadmapId,
      adjusted,
    );

    return this.attachResources(userId, roadmapId, applied);
  }

  /**
   * Etapa 8 — recursos dos tópicos NOVOS e dos que mudaram de título. Roda
   * depois do commit do reajuste, nunca dentro dele: a descoberta leva segundos
   * por tópico, e segurar a transação aberta por todo esse tempo seria pior que
   * o problema que resolve.
   *
   * Tudo aqui é best-effort. O reajuste já está gravado e é o que o usuário
   * pediu; falhar em achar links não pode transformar um reajuste bem-sucedido
   * numa resposta de erro — no pior caso os tópicos novos aparecem sem recursos.
   */
  private async attachResources(
    userId: string,
    roadmapId: string,
    applied: AppliedAdjustment,
  ): Promise<AdjustRoadmapResponseDto> {
    const pending = applied.topicsNeedingResources;
    if (pending.length === 0) {
      return applied.response;
    }

    try {
      const found = await this.resources.discoverForTopics(pending);
      await this.userRoadmaps.replaceTopicResources(
        pending.map((topic) => topic.id),
        found,
      );

      // Relê pelo caminho normal para a resposta já sair com os recursos —
      // o frontend grava esse roadmap direto no cache, sem refetch.
      return {
        ...applied.response,
        roadmap: await this.userRoadmaps.findDetail(userId, roadmapId),
      };
    } catch (error) {
      this.logger.error(
        `Falha ao anexar recursos após o reajuste do roadmap ${roadmapId}`,
        error as Error,
      );
      return applied.response;
    }
  }
}
