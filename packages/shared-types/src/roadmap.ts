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

/**
 * Forma gerada (Gemini) ou vinda do cache de templates. NÃO é mais a resposta de
 * POST /roadmap/generate desde a Etapa 6 — virou contrato interno da API: é o
 * que o Gemini devolve e o que fica no `payload` jsonb de `roadmap_templates`.
 * O endpoint responde `RoadmapDetailDto` (abaixo), já persistido e com ids.
 */
export interface RoadmapResponseDto {
  targetArea: TargetArea;
  /** Justificativa da área sugerida, referenciando as respostas do wizard. */
  justification: string;
  modules: RoadmapModuleDto[];
}

// ---------------------------------------------------------------------------
// Etapa 6 (FR-03.2 / FR-03.3) — roadmap PERSISTIDO e vinculado ao usuário.
//
// Diferença essencial para os DTOs acima: aqui tudo tem `id` real (linha no
// banco) e tópico tem `isCompleted`. O que está acima é molde compartilhado
// (cache genérico por critério); o que está abaixo é a instância de UM usuário —
// marcar progresso mexe só na instância, nunca no molde.
// ---------------------------------------------------------------------------

/** Ciclo de vida do roadmap do usuário (CLAUDE.md §5). */
export const ROADMAP_STATUSES = ["draft", "active", "archived"] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

/**
 * Progresso do roadmap (FR-03.3). Vem com os brutos além do percentual: a UI
 * mostra "7 de 20 tópicos" sem ter que recontar, e o arredondamento acontece
 * num lugar só (servidor), evitando 33% no card e 34% no detalhe.
 */
export interface RoadmapProgressDto {
  completedTopics: number;
  totalTopics: number;
  /** 0–100, arredondado. 0 quando o roadmap não tem tópicos. */
  percent: number;
}

export interface PersistedTopicDto {
  id: string;
  title: string;
  /** Ordem dentro do módulo (0-based). */
  order: number;
  isCompleted: boolean;
  estimatedHours?: number;
}

export interface PersistedModuleDto {
  id: string;
  title: string;
  description: string;
  /** Ordem dentro do roadmap (0-based). */
  order: number;
  topics: PersistedTopicDto[];
}

/** Item de GET /roadmap — lista "Meus Roadmaps", sem carregar a árvore inteira. */
export interface RoadmapListItemDto {
  id: string;
  targetArea: TargetArea;
  status: RoadmapStatus;
  progress: RoadmapProgressDto;
  /** ISO 8601. */
  createdAt: string;
}

/** Resposta de GET /roadmap/:id e de POST /roadmap/generate. */
export interface RoadmapDetailDto {
  id: string;
  targetArea: TargetArea;
  justification: string;
  status: RoadmapStatus;
  /** ISO 8601. */
  createdAt: string;
  progress: RoadmapProgressDto;
  modules: PersistedModuleDto[];
}

/**
 * Resposta de PATCH /roadmap/:id/topics/:topicId. Devolve o estado final do
 * tópico (o servidor é a autoridade — o cliente aplicou um palpite otimista) e
 * o progresso recalculado, para reconciliar card e barra sem um refetch.
 */
export interface ToggleTopicResponseDto {
  topicId: string;
  isCompleted: boolean;
  progress: RoadmapProgressDto;
}
