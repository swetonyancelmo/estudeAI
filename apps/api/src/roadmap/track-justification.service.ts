import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type { WizardAnswers } from '@estudeai/shared-types';
import { classifyGeminiError, resolveGeminiModels } from './gemini-models';
import {
  JUSTIFICATION_SYSTEM_INSTRUCTION,
  buildJustificationPrompt,
  buildRuleJustification,
  sanitizeJustification,
  type JustificationFacts,
} from './track-justification';

const DEFAULT_TIMEOUT_MS = 8_000;

/**
 * Escreve o "por que esta trilha" do roadmap (docs/TRILHAS.md §6, FR-02.1).
 *
 * Camada isolada de IA, como manda o CLAUDE.md §6 — mas com uma diferença
 * deliberada em relação ao RoadmapAiService: **este método nunca lança e nunca
 * faz a geração esperar muito**. A trilha e o conteúdo já estão decididos sem
 * IA; a justificativa é acabamento. Então há um teto de tempo curto para a
 * cadeia inteira de modelos, sem retry, e qualquer falha cai no texto por
 * regra.
 *
 * O teto é repartido igualmente entre os modelos: um modelo que trava (o
 * flash principal faz isso sob alta demanda) gasta só a própria fatia, e o
 * modelo reserva ainda tem tempo de responder.
 */
@Injectable()
export class TrackJustificationService {
  private readonly logger = new Logger(TrackJustificationService.name);
  private client: GoogleGenAI | null = null;

  constructor(private readonly config: ConfigService) {}

  async write(
    answers: WizardAnswers,
    facts: JustificationFacts,
  ): Promise<string> {
    const fallback = buildRuleJustification(answers, facts);

    const client = this.getClient();
    if (!client) {
      return fallback;
    }

    const models = resolveGeminiModels(this.config);
    const total = AbortSignal.timeout(this.timeoutMs());
    const sliceMs = Math.ceil(this.timeoutMs() / models.length);

    for (const model of models) {
      if (total.aborted) {
        break;
      }
      const signal = AbortSignal.any([total, AbortSignal.timeout(sliceMs)]);
      try {
        const response = await client.models.generateContent({
          model,
          contents: buildJustificationPrompt(answers, facts),
          config: {
            systemInstruction: JUSTIFICATION_SYSTEM_INSTRUCTION,
            temperature: 0.6,
            abortSignal: signal,
          },
        });

        const text = sanitizeJustification(response.text);
        if (text) {
          return text;
        }
        this.logger.warn(
          `Justificativa do modelo ${model} fora do formato — usando texto por regra.`,
        );
        return fallback;
      } catch (error) {
        this.logger.warn(
          `Justificativa via ${model} falhou: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        // Estouro da fatia não é erro do modelo: segue para o próximo.
        if (!signal.aborted && classifyGeminiError(error) === 'fatal') {
          break;
        }
      }
    }

    return fallback;
  }

  private getClient(): GoogleGenAI | null {
    if (this.client) {
      return this.client;
    }
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      return null;
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  private timeoutMs(): number {
    const raw = this.config.get<string>('JUSTIFICATION_TIMEOUT_MS');
    const parsed = raw === undefined ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
  }
}
