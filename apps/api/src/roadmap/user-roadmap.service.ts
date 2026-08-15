import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import type {
  AdjustRoadmapResponseDto,
  AdjustedRoadmapDto,
  ResourceContentDto,
  RoadmapDetailDto,
  RoadmapListItemDto,
  RoadmapProgressDto,
  RoadmapResponseDto,
  ToggleTopicResponseDto,
} from '@estudeai/shared-types';
import { Roadmap } from './entities/roadmap.entity';
// A entidade se chama Module (ARCHITETURE.md §4); o alias evita ler como o
// decorator @Module do Nest, mesmo padrão de roadmap.module.ts.
import { Module as ModuleEntity } from './entities/module.entity';
import { Resource } from './entities/resource.entity';
import { Topic } from './entities/topic.entity';
import { buildAdjustmentPlan } from './roadmap-adjust.validator';

/** Linha crua da query agregada da lista (COUNT volta como string no pg). */
interface RoadmapListRow {
  id: string;
  targetArea: RoadmapListItemDto['targetArea'];
  status: RoadmapListItemDto['status'];
  createdAt: Date;
  totalTopics: string;
  completedTopics: string;
}

/**
 * O que `applyAdjustment` devolve internamente: a resposta do endpoint MAIS a
 * lista de tópicos que precisam de recursos novos (Etapa 8).
 *
 * O segundo campo não faz parte do contrato com o frontend — é recado de um
 * service para o outro, e o `RoadmapAdjustService` o consome sem repassar. Por
 * isso o tipo mora aqui, e não em `@estudeai/shared-types`.
 */
export interface AppliedAdjustment {
  response: AdjustRoadmapResponseDto;
  topicsNeedingResources: { id: string; title: string }[];
}

/**
 * FR-03.2 / FR-03.3 — instâncias de roadmap do usuário e seu progresso.
 *
 * Responsabilidade única, no mesmo espírito que separa RoadmapCacheService de
 * RoadmapAiService: aqui não se sabe nada sobre Gemini nem sobre cache. O
 * RoadmapService orquestra — obtém o conteúdo (molde) e manda copiar aqui.
 *
 * Ownership é responsabilidade DESTE service, não do controller: assim toda
 * porta de entrada (inclusive as da Etapa 7) passa pela mesma checagem.
 */
@Injectable()
export class UserRoadmapService {
  constructor(
    @InjectRepository(Roadmap)
    private readonly roadmaps: Repository<Roadmap>,
    @InjectRepository(Topic)
    private readonly topics: Repository<Topic>,
  ) {}

  /**
   * Copia um roadmap gerado (Gemini ou template em cache) para linhas próprias
   * do usuário. É uma CÓPIA campo a campo, deliberadamente: o `payload` que
   * chega pode ser o jsonb de um `RoadmapTemplate` compartilhado por vários
   * usuários — nada dele pode ser referenciado nem mutado aqui. Todo tópico
   * nasce com isCompleted=false, então o progresso é sempre individual.
   *
   * Os recursos (Etapa 8) seguem a mesma regra: viram linhas próprias em
   * `topic_resources`, copiadas do molde, na mesma transação.
   */
  async createFrom(
    userId: string,
    payload: RoadmapResponseDto,
  ): Promise<RoadmapDetailDto> {
    const roadmap = this.roadmaps.create({
      userId,
      targetArea: payload.targetArea,
      justification: payload.justification,
      status: 'active',
      modules: payload.modules.map((module) => ({
        title: module.title,
        description: module.description,
        order: module.order,
        topics: module.topics.map((topic) => ({
          title: topic.title,
          order: topic.order,
          isCompleted: false,
          estimatedHours: topic.estimatedHours ?? null,
          resources: this.toResourceRows(topic.resources),
        })),
      })),
    });

    // cascade:['insert'] grava roadmap + módulos + tópicos + recursos numa
    // transação só.
    const saved = await this.roadmaps.save(roadmap);

    // Relemos pelo caminho normal: a resposta do POST fica byte a byte igual à
    // do GET /roadmap/:id, sem depender de quais colunas o save() devolve.
    return this.findDetail(userId, saved.id);
  }

  /**
   * Lista os roadmaps do usuário com o progresso agregado no banco — uma query
   * só, sem N+1 e sem carregar as árvores inteiras.
   */
  async listForUser(userId: string): Promise<RoadmapListItemDto[]> {
    const rows = await this.roadmaps
      .createQueryBuilder('r')
      .leftJoin('r.modules', 'm')
      .leftJoin('m.topics', 't')
      .select('r.id', 'id')
      .addSelect('r.targetArea', 'targetArea')
      .addSelect('r.status', 'status')
      .addSelect('r.createdAt', 'createdAt')
      .addSelect('COUNT(t.id)', 'totalTopics')
      .addSelect(
        'COUNT(t.id) FILTER (WHERE t.is_completed)',
        'completedTopics',
      )
      .where('r.userId = :userId', { userId })
      .groupBy('r.id')
      .orderBy('r.createdAt', 'DESC')
      .getRawMany<RoadmapListRow>();

    return rows.map((row) => ({
      id: row.id,
      targetArea: row.targetArea,
      status: row.status,
      createdAt: new Date(row.createdAt).toISOString(),
      progress: this.toProgress(
        Number(row.completedTopics),
        Number(row.totalTopics),
      ),
    }));
  }

  /** Detalhe completo (módulos + tópicos), já validando ownership. */
  async findDetail(
    userId: string,
    roadmapId: string,
  ): Promise<RoadmapDetailDto> {
    const roadmap = await this.loadOwned(userId, roadmapId);
    return this.toDetailDto(roadmap);
  }

  /**
   * FR-03.3 — alterna a conclusão de um tópico. O tópico precisa pertencer a um
   * módulo DESTE roadmap: um topicId de outro usuário sob um :id próprio dá 404.
   */
  async toggleTopic(
    userId: string,
    roadmapId: string,
    topicId: string,
  ): Promise<ToggleTopicResponseDto> {
    const roadmap = await this.loadOwned(userId, roadmapId);

    const topic = roadmap.modules
      .flatMap((module) => module.topics)
      .find((candidate) => candidate.id === topicId);

    if (!topic) {
      throw new NotFoundException('Tópico não encontrado neste roadmap.');
    }

    topic.isCompleted = !topic.isCompleted;
    await this.topics.save(topic);

    // A árvore em memória já reflete o toggle — o progresso sai dela, sem
    // uma segunda ida ao banco.
    return {
      topicId: topic.id,
      isCompleted: topic.isCompleted,
      progress: this.progressOf(roadmap),
    };
  }

  /**
   * Exclui o roadmap do usuário. Só a linha de `roadmaps` é apagada: módulos e
   * tópicos vão junto pelo ON DELETE CASCADE da migration (regra no banco, não
   * na aplicação), e `roadmap_templates` não é tocado — o cache é molde
   * compartilhado, não pertence a este usuário.
   *
   * Passa pelo mesmo `loadOwned` do resto: 404 se não existe, 403 se é de outra
   * pessoa. Excluir é irreversível, então distinguir os dois importa mais aqui
   * do que em qualquer outra rota.
   */
  async remove(userId: string, roadmapId: string): Promise<void> {
    const roadmap = await this.loadOwned(userId, roadmapId);
    await this.roadmaps.delete({ id: roadmap.id });
  }

  /**
   * FR-04.2 — aplica um reajuste já produzido pela IA. É o MESMO roadmap: o id,
   * a targetArea e a justification não são tocados; muda só a árvore de módulos
   * e tópicos.
   *
   * Tudo numa transação, e o plano de escrita é (re)construído AQUI DENTRO,
   * contra o estado recém-lido: se o usuário marcou um tópico enquanto a IA
   * pensava (a chamada leva segundos), a validação de integridade roda de novo
   * sobre a realidade atual e rejeita o ajuste em vez de gravar por cima.
   *
   * Além disso, as escritas destrutivas carregam a regra no próprio SQL
   * (`is_completed = false`, `NOT EXISTS (... concluído ...)`). Assim nem uma
   * corrida na janela entre o SELECT e o DELETE consegue remover progresso: o
   * banco simplesmente não apaga a linha. É a terceira camada, depois do prompt
   * e do validador.
   */
  async applyAdjustment(
    userId: string,
    roadmapId: string,
    ai: AdjustedRoadmapDto,
  ): Promise<AppliedAdjustment> {
    return this.roadmaps.manager.transaction(async (manager) => {
      const before = await this.loadOwned(userId, roadmapId, manager);
      const plan = buildAdjustmentPlan(this.toDetailDto(before), ai);

      if (plan.topicIdsToDelete.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(Topic)
          .where('id IN (:...ids)', { ids: plan.topicIdsToDelete })
          .andWhere('is_completed = false')
          .execute();
      }

      if (plan.moduleIdsToDelete.length > 0) {
        await manager
          .createQueryBuilder()
          .delete()
          .from(ModuleEntity)
          .where('id IN (:...ids)', { ids: plan.moduleIdsToDelete })
          .andWhere(
            `NOT EXISTS (
               SELECT 1 FROM "roadmap_topics" t
               WHERE t."module_id" = "roadmap_modules"."id" AND t."is_completed"
             )`,
          )
          .execute();
      }

      if (plan.moduleInserts.length > 0) {
        await manager.insert(
          ModuleEntity,
          plan.moduleInserts.map((module) => ({ ...module, roadmapId })),
        );
      }

      for (const module of plan.moduleUpdates) {
        await manager.update(ModuleEntity, module.id, {
          title: module.title,
          description: module.description,
          order: module.order,
        });
      }

      if (plan.topicInserts.length > 0) {
        await manager.insert(
          Topic,
          plan.topicInserts.map((topic) => ({
            id: topic.id,
            moduleId: topic.moduleId,
            title: topic.title,
            order: topic.order,
            isCompleted: false,
            estimatedHours: this.toIntHours(topic.estimatedHours),
          })),
        );
      }

      // Só tópicos PENDENTES têm conteúdo reescrito — e o `is_completed = false`
      // no WHERE garante isso mesmo se o estado mudar no meio da transação.
      for (const topic of plan.topicUpdates) {
        await manager
          .createQueryBuilder()
          .update(Topic)
          .set({
            moduleId: topic.moduleId,
            title: topic.title,
            order: topic.order,
            estimatedHours: this.toIntHours(topic.estimatedHours),
          })
          .where('id = :id', { id: topic.id })
          .andWhere('is_completed = false')
          .execute();
      }

      // Concluídos: só a posição. Nenhuma coluna de conteúdo entra neste UPDATE.
      for (const { id, order } of plan.completedTopicOrders) {
        await manager.update(Topic, id, { order });
      }

      const after = await this.loadOwned(userId, roadmapId, manager);
      return {
        response: {
          roadmap: this.toDetailDto(after),
          adjustmentSummary: ai.adjustmentSummary,
          changes: plan.changes,
        },
        // A descoberta de recursos NÃO acontece aqui: ela leva segundos por
        // tópico e manteria esta transação aberta o tempo todo. O orquestrador
        // faz isso depois do commit (Etapa 8).
        topicsNeedingResources: plan.topicsNeedingResources,
      };
    });
  }

  /**
   * Etapa 8 — troca os recursos de tópicos que mudaram de assunto no reajuste.
   *
   * Apaga os antigos de TODOS os `topicIds` informados, mesmo os que não
   * receberam substitutos: se o título mudou, os links velhos falam de outra
   * coisa e ficar sem recurso é melhor do que ficar com o recurso errado.
   */
  async replaceTopicResources(
    topicIds: string[],
    resourcesByTopicId: Map<string, ResourceContentDto[]>,
  ): Promise<void> {
    if (topicIds.length === 0) {
      return;
    }

    await this.roadmaps.manager.transaction(async (manager) => {
      await manager.delete(Resource, { topicId: In(topicIds) });

      const rows = topicIds.flatMap((topicId) =>
        this.toResourceRows(resourcesByTopicId.get(topicId)).map(
          (resource) => ({
            ...resource,
            topicId,
          }),
        ),
      );

      if (rows.length > 0) {
        await manager.insert(Resource, rows);
      }
    });
  }

  /**
   * Molde → linhas de `topic_resources`. Deduplica por URL porque a tabela tem
   * UNIQUE (topic_id, url): um template gravado por uma versão anterior poderia
   * trazer repetição e derrubar o insert inteiro.
   */
  private toResourceRows(resources: ResourceContentDto[] | undefined) {
    if (!resources || resources.length === 0) {
      return [];
    }

    const seen = new Set<string>();
    return resources.flatMap((resource) => {
      if (seen.has(resource.url)) {
        return [];
      }
      seen.add(resource.url);
      return [
        {
          title: resource.title,
          url: resource.url,
          type: resource.type,
          thumbnailUrl: resource.thumbnailUrl ?? null,
          source: resource.source,
        },
      ];
    });
  }

  /** `estimated_hours` é integer no banco; a IA pode mandar 4.5. */
  private toIntHours(hours: number | null): number | null {
    return hours === null ? null : Math.round(hours);
  }

  /**
   * Carrega o roadmap pelo id e só então compara o dono. Buscar por
   * `{ id, userId }` seria mais curto, mas devolveria 404 para roadmap de
   * outra pessoa — queremos distinguir "não existe" (404) de "não é seu" (403).
   *
   * `manager` presente = leitura dentro de uma transação (reajuste); ausente =
   * repositório normal. A regra de ownership é a mesma nos dois caminhos.
   */
  private async loadOwned(
    userId: string,
    roadmapId: string,
    manager?: EntityManager,
  ): Promise<Roadmap> {
    const repository = manager ? manager.getRepository(Roadmap) : this.roadmaps;
    const roadmap = await repository.findOne({
      where: { id: roadmapId },
      relations: { modules: { topics: { resources: true } } },
    });

    if (!roadmap) {
      throw new NotFoundException('Roadmap não encontrado.');
    }
    if (roadmap.userId !== userId) {
      throw new ForbiddenException('Este roadmap pertence a outro usuário.');
    }
    return roadmap;
  }

  private toDetailDto(roadmap: Roadmap): RoadmapDetailDto {
    return {
      id: roadmap.id,
      targetArea: roadmap.targetArea,
      justification: roadmap.justification,
      status: roadmap.status,
      createdAt: roadmap.createdAt.toISOString(),
      progress: this.progressOf(roadmap),
      modules: [...roadmap.modules]
        .sort((a, b) => a.order - b.order)
        .map((module) => ({
          id: module.id,
          title: module.title,
          description: module.description,
          order: module.order,
          topics: [...module.topics]
            .sort((a, b) => a.order - b.order)
            .map((topic) => ({
              id: topic.id,
              title: topic.title,
              order: topic.order,
              isCompleted: topic.isCompleted,
              estimatedHours: topic.estimatedHours ?? undefined,
              resources: this.toResourceDtos(topic.resources),
            })),
        })),
    };
  }

  /**
   * Recursos do tópico, sempre como array (a relação pode nem ter sido
   * carregada) e em ordem estável: YouTube antes de web, depois por título.
   *
   * A ordenação não vem do banco de propósito — `created_at` é o mesmo para
   * todas as linhas gravadas na mesma transação, então não serve de critério.
   */
  private toResourceDtos(resources: Resource[] | undefined) {
    return [...(resources ?? [])]
      .sort(
        (a, b) =>
          Number(a.source === 'web') - Number(b.source === 'web') ||
          a.title.localeCompare(b.title),
      )
      .map((resource) => ({
        id: resource.id,
        title: resource.title,
        url: resource.url,
        type: resource.type,
        source: resource.source,
        ...(resource.thumbnailUrl
          ? { thumbnailUrl: resource.thumbnailUrl }
          : {}),
      }));
  }

  private progressOf(roadmap: Roadmap): RoadmapProgressDto {
    const topics = roadmap.modules.flatMap((module) => module.topics);
    const completed = topics.filter((topic) => topic.isCompleted).length;
    return this.toProgress(completed, topics.length);
  }

  /** Fórmula única do percentual — lista, detalhe e toggle não podem divergir. */
  private toProgress(completed: number, total: number): RoadmapProgressDto {
    return {
      completedTopics: completed,
      totalTopics: total,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }
}
