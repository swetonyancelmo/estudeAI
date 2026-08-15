import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, type Schema } from '@google/genai';
import {
  TARGET_AREAS,
  type AdjustedModuleDto,
  type AdjustedRoadmapDto,
  type AdjustedTopicDto,
  type RoadmapDetailDto,
  type RoadmapModuleDto,
  type RoadmapResponseDto,
  type RoadmapTopicDto,
  type TargetArea,
  type WizardAnswers,
} from '@estudeai/shared-types';
import { ROADMAP_RESPONSE_SCHEMA } from './roadmap-ai.schema';
import {
  ROADMAP_SYSTEM_INSTRUCTION,
  buildRoadmapUserPrompt,
} from './roadmap-ai.prompt';
import { ROADMAP_ADJUST_RESPONSE_SCHEMA } from './roadmap-adjust.schema';
import {
  ROADMAP_ADJUST_SYSTEM_INSTRUCTION,
  buildAdjustUserPrompt,
} from './roadmap-adjust.prompt';

// Alias resiliente: acompanha o flash atual e não vira 404 quando uma versão
// fixa é aposentada para novos usuários. Sobrescreva com GEMINI_MODEL se quiser
// fixar (ex.: gemini-3.6-flash).
const DEFAULT_MODEL = 'gemini-flash-latest';
const DEFAULT_TIMEOUT_MS = 20_000;

/** Mensagens de erro voltadas ao usuário (o frontend as exibe via extractApiError). */
const USER_MESSAGES = {
  unavailable:
    'Serviço de IA indisponível no momento. Tente novamente em instantes.',
  timeout: 'A geração do roadmap demorou mais que o esperado. Tente novamente.',
  adjustTimeout:
    'O reajuste do roadmap demorou mais que o esperado. Tente novamente.',
  badResponse: 'A IA retornou um formato inesperado. Tente novamente.',
} as const;

/** Sentinela interna do race de timeout — nunca vaza ao cliente. */
class GeminiTimeoutError extends Error {}

/**
 * Camada isolada que fala com o Gemini (CLAUDE.md §6): ÚNICO lugar do projeto
 * que importa `@google/genai`. Recebe as respostas do wizard e devolve o
 * `RoadmapResponseDto` já validado. Sem cache (Etapa 5) e sem persistência
 * (Etapa 6): a cada chamada bate no Gemini de verdade.
 *
 * Etapa 7 (FR-04): ganha um segundo caso de uso, `adjustRoadmap`, com prompt e
 * schema PRÓPRIOS — mesma infraestrutura (client, timeout, tradução de erros),
 * tarefas diferentes. Este service continua sem saber o que é banco: quem
 * confere se a IA respeitou o progresso é o validador, não ele.
 */
@Injectable()
export class RoadmapAiService {
  private readonly logger = new Logger(RoadmapAiService.name);
  private client: GoogleGenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  async generate(answers: WizardAnswers): Promise<RoadmapResponseDto> {
    const rawText = await this.callGemini({
      contents: buildRoadmapUserPrompt(answers),
      systemInstruction: ROADMAP_SYSTEM_INSTRUCTION,
      responseSchema: ROADMAP_RESPONSE_SCHEMA,
      temperature: 0.7,
      timeoutMessage: USER_MESSAGES.timeout,
    });

    return this.parseAndValidate(rawText);
  }

  /**
   * FR-04.1/FR-04.2 — recalcula um roadmap que JÁ existe. Recebe o detalhe
   * persistido (com ids e isCompleted) e o pedido em linguagem natural.
   *
   * Temperatura mais baixa que a da geração: aqui não se quer criatividade de
   * estrutura, e sim obediência — a IA precisa ecoar ids e tópicos concluídos
   * com exatidão. O que sai daqui é só a forma validada; a conferência de
   * integridade contra o banco acontece depois, no `buildAdjustmentPlan`.
   */
  async adjustRoadmap(
    current: RoadmapDetailDto,
    adjustmentRequest: string,
  ): Promise<AdjustedRoadmapDto> {
    const rawText = await this.callGemini({
      contents: buildAdjustUserPrompt(current, adjustmentRequest),
      systemInstruction: ROADMAP_ADJUST_SYSTEM_INSTRUCTION,
      responseSchema: ROADMAP_ADJUST_RESPONSE_SCHEMA,
      temperature: 0.3,
      timeoutMessage: USER_MESSAGES.adjustTimeout,
    });

    return this.parseAndValidateAdjustment(rawText);
  }

  /**
   * Chamada ao Gemini compartilhada pelos dois casos de uso: resolve o modelo,
   * corre contra o timeout e traduz qualquer falha de transporte em HTTP. Só o
   * prompt, o schema e a mensagem de timeout mudam entre geração e reajuste.
   */
  private async callGemini(options: {
    contents: string;
    systemInstruction: string;
    responseSchema: Schema;
    temperature: number;
    timeoutMessage: string;
  }): Promise<string | undefined> {
    const client = this.getClient();
    const model = this.config.get<string>('GEMINI_MODEL') ?? DEFAULT_MODEL;
    const timeoutMs = this.resolveTimeoutMs();

    try {
      const controller = new AbortController();
      return await this.withTimeout(
        client.models
          .generateContent({
            model,
            contents: options.contents,
            config: {
              systemInstruction: options.systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: options.responseSchema,
              temperature: options.temperature,
              abortSignal: controller.signal,
            },
          })
          .then((response) => response.text),
        timeoutMs,
        controller,
      );
    } catch (error) {
      throw this.toHttpException(error, options.timeoutMessage);
    }
  }

  /** Cria (uma vez) o client do Gemini; sem API key, o serviço está indisponível. */
  private getClient(): GoogleGenAI {
    if (this.client) {
      return this.client;
    }
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY ausente — não é possível chamar o Gemini.');
      throw new ServiceUnavailableException(USER_MESSAGES.unavailable);
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  private resolveTimeoutMs(): number {
    const raw = this.config.get<string>('GEMINI_TIMEOUT_MS');
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
  }

  /**
   * Corre a promessa do Gemini contra um timer. Se o timer vence, aborta a
   * requisição (economiza tokens) e rejeita com um erro distinguível (→ 504).
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    controller: AbortController,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new GeminiTimeoutError());
      }, timeoutMs);
    });
    return Promise.race([promise, timeout]).finally(() =>
      clearTimeout(timer),
    ) as Promise<T>;
  }

  /** Mapeia qualquer falha da chamada ao Gemini para um HttpException apropriado. */
  private toHttpException(error: unknown, timeoutMessage: string) {
    if (error instanceof GeminiTimeoutError) {
      this.logger.warn('Timeout ao chamar o Gemini.');
      return new GatewayTimeoutException(timeoutMessage);
    }
    this.logger.error('Falha na chamada ao Gemini', error as Error);
    // Erro de autenticação (API key inválida) também é tratado como indisponível
    // para o usuário — a causa real fica só no log do servidor.
    return new ServiceUnavailableException(USER_MESSAGES.unavailable);
  }

  /**
   * Parseia e valida o JSON do Gemini contra o contrato. Qualquer desvio (texto
   * vazio, JSON inválido, forma fora do RoadmapResponseDto) vira 502 — a resposta
   * chegou, mas não é utilizável. Também reindexa `order` sequencialmente para
   * garantir keys estáveis/únicas no React, independentemente do que a IA numerou.
   */
  private parseAndValidate(rawText: string | undefined): RoadmapResponseDto {
    if (!rawText || rawText.trim().length === 0) {
      throw new BadGatewayException(USER_MESSAGES.badResponse);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      this.logger.error('Gemini retornou JSON inválido.');
      throw new BadGatewayException(USER_MESSAGES.badResponse);
    }

    if (!this.isRoadmapResponse(parsed)) {
      this.logger.error('Resposta do Gemini fora do contrato RoadmapResponseDto.');
      throw new BadGatewayException(USER_MESSAGES.badResponse);
    }

    return {
      targetArea: parsed.targetArea,
      justification: parsed.justification,
      modules: parsed.modules.map<RoadmapModuleDto>((module, moduleIndex) => ({
        title: module.title,
        description: module.description,
        order: moduleIndex,
        topics: module.topics.map<RoadmapTopicDto>((topic, topicIndex) => ({
          title: topic.title,
          order: topicIndex,
          ...(typeof topic.estimatedHours === 'number'
            ? { estimatedHours: topic.estimatedHours }
            : {}),
        })),
      })),
    };
  }

  /** Type guard: confere a forma mínima do RoadmapResponseDto vinda da IA. */
  private isRoadmapResponse(value: unknown): value is {
    targetArea: TargetArea;
    justification: string;
    modules: {
      title: string;
      description: string;
      topics: { title: string; estimatedHours?: number }[];
    }[];
  } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;

    if (!TARGET_AREAS.includes(v.targetArea as TargetArea)) {
      return false;
    }
    if (typeof v.justification !== 'string' || v.justification.trim() === '') {
      return false;
    }
    if (!Array.isArray(v.modules) || v.modules.length === 0) {
      return false;
    }

    return v.modules.every((module) => {
      if (typeof module !== 'object' || module === null) {
        return false;
      }
      const m = module as Record<string, unknown>;
      if (typeof m.title !== 'string' || m.title.trim() === '') {
        return false;
      }
      if (typeof m.description !== 'string') {
        return false;
      }
      if (!Array.isArray(m.topics) || m.topics.length === 0) {
        return false;
      }
      return m.topics.every((topic) => {
        if (typeof topic !== 'object' || topic === null) {
          return false;
        }
        const t = topic as Record<string, unknown>;
        return typeof t.title === 'string' && t.title.trim() !== '';
      });
    });
  }

  /**
   * Parse + validação de FORMA da resposta do reajuste. Aqui só se pergunta "é
   * um AdjustedRoadmapDto?" — nada sobre progresso: este service não conhece o
   * banco. Desvio de forma vira 502, igual à geração.
   *
   * A normalização é conservadora de propósito: campos desconhecidos são
   * descartados e `id` só sobrevive se for string não vazia. Assim o validador
   * de integridade recebe uma estrutura previsível, sem `id: ""` ou
   * `estimatedHours: NaN` para tratar.
   */
  private parseAndValidateAdjustment(
    rawText: string | undefined,
  ): AdjustedRoadmapDto {
    if (!rawText || rawText.trim().length === 0) {
      throw new BadGatewayException(USER_MESSAGES.badResponse);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      this.logger.error('Gemini retornou JSON inválido no reajuste.');
      throw new BadGatewayException(USER_MESSAGES.badResponse);
    }

    if (!this.isAdjustedRoadmap(parsed)) {
      this.logger.error('Resposta do reajuste fora do contrato AdjustedRoadmapDto.');
      throw new BadGatewayException(USER_MESSAGES.badResponse);
    }

    return {
      adjustmentSummary: parsed.adjustmentSummary,
      modules: parsed.modules.map<AdjustedModuleDto>((module) => ({
        ...(typeof module.id === 'string' && module.id.trim() !== ''
          ? { id: module.id }
          : {}),
        title: module.title,
        description: module.description,
        topics: module.topics.map<AdjustedTopicDto>((topic) => ({
          ...(typeof topic.id === 'string' && topic.id.trim() !== ''
            ? { id: topic.id }
            : {}),
          title: topic.title,
          isCompleted: topic.isCompleted === true,
          ...(typeof topic.estimatedHours === 'number' &&
          Number.isFinite(topic.estimatedHours)
            ? { estimatedHours: topic.estimatedHours }
            : {}),
        })),
      })),
    };
  }

  /** Type guard da forma mínima do AdjustedRoadmapDto vinda da IA. */
  private isAdjustedRoadmap(value: unknown): value is {
    adjustmentSummary: string;
    modules: {
      id?: unknown;
      title: string;
      description: string;
      topics: {
        id?: unknown;
        title: string;
        isCompleted: unknown;
        estimatedHours?: unknown;
      }[];
    }[];
  } {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const v = value as Record<string, unknown>;

    if (
      typeof v.adjustmentSummary !== 'string' ||
      v.adjustmentSummary.trim() === ''
    ) {
      return false;
    }
    if (!Array.isArray(v.modules) || v.modules.length === 0) {
      return false;
    }

    return v.modules.every((module) => {
      if (typeof module !== 'object' || module === null) {
        return false;
      }
      const m = module as Record<string, unknown>;
      if (typeof m.title !== 'string' || m.title.trim() === '') {
        return false;
      }
      if (typeof m.description !== 'string') {
        return false;
      }
      if (!Array.isArray(m.topics) || m.topics.length === 0) {
        return false;
      }
      return m.topics.every((topic) => {
        if (typeof topic !== 'object' || topic === null) {
          return false;
        }
        const t = topic as Record<string, unknown>;
        return (
          typeof t.title === 'string' &&
          t.title.trim() !== '' &&
          typeof t.isCompleted === 'boolean'
        );
      });
    });
  }
}
