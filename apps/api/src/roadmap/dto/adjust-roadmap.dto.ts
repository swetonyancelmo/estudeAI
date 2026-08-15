import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { AdjustRoadmapRequestDto } from '@estudeai/shared-types';

/**
 * Payload de POST /roadmap/:id/adjust (FR-04.1) — texto livre do usuário.
 *
 * O limite de 500 caracteres não é estética: este texto entra no prompt do
 * Gemini, então é a única entrada não confiável da cadeia. Um teto baixo reduz
 * custo por chamada e o espaço para tentativas de injeção; a defesa real contra
 * o que a IA responde está no validador de integridade, não aqui.
 */
export class AdjustRoadmapDto implements AdjustRoadmapRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'Descreva o ajuste que você quer.' })
  @MinLength(5, {
    message: 'Descreva o ajuste com um pouco mais de detalhe.',
  })
  @MaxLength(500, {
    message: 'O pedido de ajuste deve ter no máximo 500 caracteres.',
  })
  adjustmentRequest: string;
}
