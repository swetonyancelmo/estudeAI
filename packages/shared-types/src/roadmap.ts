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

/** Horas por semana que cada faixa representa, para estimar a duração. */
export const WEEKLY_HOURS: Record<WeeklyTime, number> = {
  "5h": 5,
  "15h": 15,
  "30h+": 30,
};

/**
 * Afinidade: interface/visual, lógica/dados ou infraestrutura (FR-01.2).
 * Só é perguntada a quem ainda não sabe a área — ver `WizardAnswers.affinity`.
 */
export const AFFINITIES = ["visual", "logica", "infra"] as const;
export type Affinity = (typeof AFFINITIES)[number];

/** Estilo de aprendizado (FR-01.2): mão-na-massa, teoria/docs ou vídeo-aulas. */
export const LEARNING_STYLES = ["pratico", "teorico", "audiovisual"] as const;
export type LearningStyle = (typeof LEARNING_STYLES)[number];

/** Área do roadmap (FR-02.1) — uma trilha curada por valor (docs/TRILHAS.md). */
export const TARGET_AREAS = [
  "frontend",
  "backend",
  "fullstack",
  "devops",
] as const;
export type TargetArea = (typeof TARGET_AREAS)[number];

/** Resposta de "já sabe qual área quer seguir?": uma área ou "ainda não sei". */
export const UNDECIDED_AREA = "nao-sei";
export const WIZARD_AREAS = [...TARGET_AREAS, UNDECIDED_AREA] as const;
export type WizardArea = (typeof WIZARD_AREAS)[number];

/** Habilidades que, se já dominadas, dispensam tópicos da trilha. */
export const KNOWN_SKILLS = [
  "logica-programacao",
  "html-css",
  "javascript",
  "typescript",
  "git",
  "terminal-linux",
  "sql",
  "http-apis",
  "react",
  "nodejs",
  "docker",
  "cloud",
] as const;
export type KnownSkill = (typeof KNOWN_SKILLS)[number];

/**
 * Respostas do wizard — payload de entrada de POST /roadmap/generate.
 * Os 4 campos do FR-01.2 mais os dois das trilhas curadas (docs/TRILHAS.md §3).
 */
export interface WizardAnswers {
  goal: LearningGoal;
  /** Área escolhida pela pessoa, ou "nao-sei" para a regra decidir. */
  area: WizardArea;
  /**
   * Só existe quando `area` é "nao-sei": é o que desempata a trilha. Quem já
   * escolheu a área não é perguntado, e a API descarta o campo se vier.
   */
  affinity?: Affinity;
  /** O que a pessoa já domina. Vazio = começando do zero. */
  knownSkills: KnownSkill[];
  weeklyTime: WeeklyTime;
  learningStyle: LearningStyle;
}

// ---------------------------------------------------------------------------
// Etapa 8 — recursos gratuitos de estudo por tópico (vídeos/playlists do
// YouTube + artigos da web).
//
// Fora do escopo do REQUIREMENTS.md, mas com a mesma divisão do resto deste
// arquivo: `ResourceContentDto` é MOLDE (o que a descoberta produz e o que fica
// no jsonb do template em cache) e `ResourceDto` é a linha PERSISTIDA.
// ---------------------------------------------------------------------------

/** Natureza do recurso — decide o ícone e se há thumbnail a exibir. */
export const RESOURCE_TYPES = ["video", "playlist", "article"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** De onde o link veio: YouTube Data API ou grounding do Google Search. */
export const RESOURCE_SOURCES = ["youtube", "web"] as const;
export type ResourceSource = (typeof RESOURCE_SOURCES)[number];

/**
 * Recurso ainda sem id. Toda URL aqui já passou por validação HTTP e é a URL
 * FINAL (pós-redirect) — nada é aproveitado do texto livre da IA.
 */
export interface ResourceContentDto {
  title: string;
  url: string;
  type: ResourceType;
  /** Só existe para YouTube (vídeo/playlist). */
  thumbnailUrl?: string;
  source: ResourceSource;
}

/** Recurso persistido, ligado a um Topic real. */
export interface ResourceDto extends ResourceContentDto {
  id: string;
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
  /**
   * Etapa 8. NÃO vem do Structured Output do Gemini: é anexado depois, pela
   * descoberta de recursos, antes de gravar no cache.
   *
   * Opcional de propósito — a AUSÊNCIA do campo é o que distingue um template
   * gravado antes da Etapa 8 de um já enriquecido, e é o sinal que dispara o
   * backfill no primeiro cache hit. Presente e vazio = já buscamos e não
   * sobrou nada válido; não adianta buscar de novo.
   */
  resources?: ResourceContentDto[];
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

/**
 * O que o item do roadmap é: um tópico de estudo ou o projeto prático que
 * fecha o módulo (docs/TRILHAS.md §5). Projeto conta no progresso e nas horas
 * como qualquer item, mas não tem recursos e traz uma descrição.
 */
export const TOPIC_KINDS = ["topic", "project"] as const;
export type TopicKind = (typeof TOPIC_KINDS)[number];

export interface PersistedTopicDto {
  id: string;
  kind: TopicKind;
  title: string;
  /** Só nos projetos: o que construir. */
  description?: string;
  /** Ordem dentro do módulo (0-based). */
  order: number;
  isCompleted: boolean;
  estimatedHours?: number;
  /**
   * Etapa 8. SEMPRE presente (vazio quando a busca falhou ou não sobrou link
   * válido), ao contrário do molde: aqui o array é o estado real das linhas em
   * `topic_resources`, e a UI tem um caso só a tratar — lista vazia, some.
   */
  resources: ResourceDto[];
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
  /**
   * Ritmo declarado no wizard, em horas por semana. Nulo nos roadmaps
   * anteriores às trilhas curadas. Vem o ritmo, e não a duração pronta, porque
   * a duração depende do que falta — e isso muda a cada tópico marcado, no
   * cliente, antes de qualquer resposta do servidor.
   */
  weeklyHours: number | null;
  modules: PersistedModuleDto[];
}

/**
 * DELETE /roadmap/:id não tem tipo próprio de propósito: não recebe corpo e
 * responde 204 sem corpo. O registro fica aqui para este arquivo continuar
 * sendo o inventário completo do contrato entre web e api (CLAUDE.md §7).
 */

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

// ---------------------------------------------------------------------------
// Etapa 7 (FR-04.1 / FR-04.2) — reajuste dinâmico do roadmap ATIVO.
//
// Diferença essencial para a geração: aqui não nasce roadmap nenhum. É o MESMO
// `Roadmap` (mesmo id, mesma targetArea, mesma justification) sendo recalculado,
// e o progresso já feito é intocável. Por isso os tipos abaixo carregam ids: o
// reajuste é uma operação sobre linhas que já existem, não sobre um molde solto.
// ---------------------------------------------------------------------------

/** Payload de POST /roadmap/:id/adjust — o pedido em linguagem natural (FR-04.1). */
export interface AdjustRoadmapRequestDto {
  /** Ex.: "tenho menos tempo esta semana", "quero acelerar o módulo atual". */
  adjustmentRequest: string;
}

/**
 * FORMA que a IA devolve no reajuste. Contrato INTERNO da API (como
 * `RoadmapResponseDto`): nunca chega ao frontend, e nunca é persistido direto —
 * passa antes pelo validador de integridade.
 *
 * `id` ausente = item NOVO (a IA não inventa ids). `isCompleted` vem de volta em
 * todo tópico de propósito: é o eco que o validador confere contra o banco.
 * Não há `order`: a ordem é a posição no array, reindexada pelo servidor.
 *
 * Não há `resources` (Etapa 8) e isso é deliberado: a IA do reajuste não vê nem
 * opina sobre links — quem descobre recursos é o ResourceDiscoveryService,
 * depois do reajuste aplicado, e só para tópicos novos ou renomeados.
 */
export interface AdjustedTopicDto {
  id?: string;
  title: string;
  isCompleted: boolean;
  estimatedHours?: number;
}

export interface AdjustedModuleDto {
  id?: string;
  title: string;
  description: string;
  topics: AdjustedTopicDto[];
}

export interface AdjustedRoadmapDto {
  /** Resumo em PT-BR do que mudou — exibido ao usuário, não persistido. */
  adjustmentSummary: string;
  modules: AdjustedModuleDto[];
}

/**
 * O que o reajuste mexeu. A UI usa para distinguir visualmente o que foi
 * reorganizado do que continua concluído e intacto (`preservedTopicIds`).
 */
export interface AdjustmentChangesDto {
  /** Tópicos criados pelo reajuste (ids já reais, pós-persistência). */
  addedTopicIds: string[];
  /** Tópicos pendentes que tiveram título/estimativa/módulo alterados. */
  updatedTopicIds: string[];
  /** Tópicos concluídos, devolvidos intactos — a prova de que o progresso ficou. */
  preservedTopicIds: string[];
  removedTopicCount: number;
  addedModuleIds: string[];
  removedModuleCount: number;
}

/** Resposta de POST /roadmap/:id/adjust. */
export interface AdjustRoadmapResponseDto {
  /** Estado final, relido pelo mesmo caminho do GET /roadmap/:id. */
  roadmap: RoadmapDetailDto;
  adjustmentSummary: string;
  changes: AdjustmentChangesDto;
}

// ---------------------------------------------------------------------------
// Trilhas curadas (docs/TRILHAS.md).
//
// Vocabulário fechado usado pelo conteúdo das trilhas. `KNOWN_SKILLS` (lá em
// cima, junto do wizard) é o outro: as duas pontas precisam concordar, e um
// valor fora dessas listas num JSON de trilha é erro de conteúdo — a API
// recusa a carga.
// ---------------------------------------------------------------------------

/** Nível de um tópico dentro da trilha. */
export const TRACK_TOPIC_LEVELS = [
  "iniciante",
  "intermediario",
  "avancado",
] as const;
export type TrackTopicLevel = (typeof TRACK_TOPIC_LEVELS)[number];
