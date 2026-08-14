// Contrato do wizard de diagnóstico (FR-01) e do roadmap gerado (FR-02.1),
// compartilhado entre apps/web e apps/api. Mesmo padrão do restante do pacote:
// interfaces puras (sem dependências de framework) + const arrays como fonte
// única dos valores enum — reusados por class-validator (api), pela função mock
// e pelas listas de opções do wizard (web).

/** Objetivo do estudante (FR-01.2). */
export const LEARNING_GOALS = ["mercado", "startup"] as const;
export type LearningGoal = (typeof LEARNING_GOALS)[number];

/** Tempo semanal disponível (FR-01.2). */
export const WEEKLY_TIMES = ["5h", "15h", "30h+"] as const;
export type WeeklyTime = (typeof WEEKLY_TIMES)[number];

/** Afinidade: interface/visual vs lógica/dados (FR-01.2). */
export const AFFINITIES = ["visual", "logica"] as const;
export type Affinity = (typeof AFFINITIES)[number];

/** Estilo de aprendizado (FR-01.2): mão-na-massa, teoria/docs ou vídeo-aulas. */
export const LEARNING_STYLES = ["pratico", "teorico", "audiovisual"] as const;
export type LearningStyle = (typeof LEARNING_STYLES)[number];

/** Área sugerida pela IA (FR-02.1). */
export const TARGET_AREAS = ["frontend", "backend", "fullstack"] as const;
export type TargetArea = (typeof TARGET_AREAS)[number];

/**
 * Respostas do wizard — payload de entrada de POST /roadmap/generate.
 * Cobre os 4 campos do FR-01.2.
 */
export interface WizardAnswers {
  goal: LearningGoal;
  weeklyTime: WeeklyTime;
  affinity: Affinity;
  learningStyle: LearningStyle;
}

/**
 * FORMA FINAL esperada do Gemini (Structured Output — NFR-01).
 *
 * Deliberadamente SEM `id`/`isCompleted`/`status`/`userId`: esses campos só
 * existem depois de persistir (Etapa 6) — o Gemini não os gera. `order` dá
 * ordenação estável e serve de key estável no React. `estimatedHours` é
 * opcional para não travar o JSON Schema estrito caso a IA omita.
 *
 * A Etapa 4 (Gemini real) e a Etapa 6 (persistência) devem respeitar este
 * contrato: só muda a FONTE do dado, não a forma.
 */
export interface RoadmapTopicDto {
  title: string;
  /** Ordem dentro do módulo (0-based). */
  order: number;
  estimatedHours?: number;
}

export interface RoadmapModuleDto {
  title: string;
  description: string;
  /** Ordem dentro do roadmap (0-based). */
  order: number;
  topics: RoadmapTopicDto[];
}

/** Resposta de POST /roadmap/generate. */
export interface RoadmapResponseDto {
  targetArea: TargetArea;
  /** Justificativa da área sugerida, referenciando as respostas do wizard. */
  justification: string;
  modules: RoadmapModuleDto[];
}
