import { Type, type Schema } from '@google/genai';

/**
 * JSON Schema (Structured Output — NFR-01) do REAJUSTE. Espelha
 * `AdjustedRoadmapDto` do shared-types.
 *
 * Duas diferenças deliberadas em relação ao ROADMAP_RESPONSE_SCHEMA (geração):
 *
 *  - `targetArea` e `justification` NÃO existem aqui. O reajuste é sobre o mesmo
 *    roadmap: a área já foi decidida na geração, então tirá-las do schema faz o
 *    "não mude a área" deixar de depender de boa vontade da IA.
 *  - `id` fica FORA de `required` (mesmo truque do `estimatedHours`): id presente
 *    = item que já existe e deve ser preservado/atualizado; id ausente = item
 *    novo. É assim que a IA nos diz o que é o quê, sem inventar identificadores.
 *
 * `isCompleted` é obrigatório em todo tópico — é o eco de integridade que o
 * `roadmap-adjust.validator.ts` confere linha a linha contra o banco.
 *
 * `order` não existe no schema de propósito: a ordem é a POSIÇÃO no array e o
 * servidor reindexa (mesmo que `parseAndValidate` já faz na geração), então a IA
 * não tem como produzir ordens duplicadas ou com buracos.
 */
export const ROADMAP_ADJUST_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    adjustmentSummary: {
      type: Type.STRING,
      description:
        'Resumo em PT-BR (1 a 3 frases) do que mudou no conteúdo pendente, afirmando que o progresso concluído foi preservado.',
    },
    modules: {
      type: Type.ARRAY,
      description: 'Roadmap completo reorganizado, em ordem de estudo.',
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description:
              'id EXATO do módulo existente. Omita este campo para um módulo novo.',
          },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          topics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: {
                  type: Type.STRING,
                  description:
                    'id EXATO do tópico existente. Omita este campo para um tópico novo.',
                },
                title: { type: Type.STRING },
                isCompleted: {
                  type: Type.BOOLEAN,
                  description:
                    'Repita o valor recebido na entrada. Tópico novo é sempre false.',
                },
                estimatedHours: {
                  type: Type.NUMBER,
                  description:
                    'Estimativa de horas (opcional). Em tópico concluído, repita o valor recebido.',
                },
              },
              required: ['title', 'isCompleted'],
              propertyOrdering: [
                'id',
                'title',
                'isCompleted',
                'estimatedHours',
              ],
            },
          },
        },
        required: ['title', 'description', 'topics'],
        propertyOrdering: ['id', 'title', 'description', 'topics'],
      },
    },
  },
  required: ['adjustmentSummary', 'modules'],
  propertyOrdering: ['adjustmentSummary', 'modules'],
};
