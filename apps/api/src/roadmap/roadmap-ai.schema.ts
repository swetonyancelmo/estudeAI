import { Type, type Schema } from '@google/genai';
import { TARGET_AREAS } from '@estudeai/shared-types';

/**
 * JSON Schema (Structured Output — NFR-01) que o Gemini é OBRIGADO a seguir.
 * Espelha exatamente `RoadmapResponseDto` do shared-types: mesmos campos, mesma
 * forma, nada a mais. `targetArea` usa `TARGET_AREAS` como fonte única do enum
 * (mesma usada pelo class-validator e pelo wizard), então acrescentar uma área
 * nova no contrato propaga pra cá automaticamente.
 *
 * `estimatedHours` fica FORA de `required` — é opcional no DTO; o resto é
 * obrigatório para o JSON sempre chegar renderizável ao frontend.
 */
export const ROADMAP_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    targetArea: {
      type: Type.STRING,
      enum: [...TARGET_AREAS],
      description: 'Área sugerida para o estudante.',
    },
    justification: {
      type: Type.STRING,
      description:
        'Justificativa em PT-BR referenciando as respostas do wizard (objetivo, tempo, afinidade, estilo).',
    },
    modules: {
      type: Type.ARRAY,
      description: 'Módulos do roadmap, em ordem de estudo.',
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          order: {
            type: Type.INTEGER,
            description: 'Ordem do módulo no roadmap (0-based).',
          },
          topics: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                order: {
                  type: Type.INTEGER,
                  description: 'Ordem do tópico no módulo (0-based).',
                },
                estimatedHours: {
                  type: Type.NUMBER,
                  description: 'Estimativa de horas para o tópico (opcional).',
                },
              },
              required: ['title', 'order'],
              propertyOrdering: ['title', 'order', 'estimatedHours'],
            },
          },
        },
        required: ['title', 'description', 'order', 'topics'],
        propertyOrdering: ['title', 'description', 'order', 'topics'],
      },
    },
  },
  required: ['targetArea', 'justification', 'modules'],
  propertyOrdering: ['targetArea', 'justification', 'modules'],
};
