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

/**
 * De onde o link veio: YouTube Data API, grounding do Google Search, ou
 * documentação oficial curada no JSON da trilha (`docs`, Fase 2).
 */
export const RESOURCE_SOURCES = ["youtube", "web", "docs"] as const;
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

/**
 * Andamento do usuário num recurso (sala de estudo). Cada linha de recurso já é
 * da cópia do roadmap de UMA pessoa, então o estado mora na própria linha.
 * Só avança: um recurso concluído não volta para "em andamento".
 */
export const RESOURCE_STATUSES = ["not_started", "in_progress", "completed"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

/** Recurso persistido, ligado a um Topic real. */
export interface ResourceDto extends ResourceContentDto {
  id: string;
  status: ResourceStatus;
  /** Maior ponto já assistido, em segundos (só vídeos; 0 nos demais). */
  watchedSeconds: number;
}

/** Payload de PATCH /roadmap/:id/topics/:topicId/resources/:resourceId. */
export interface UpdateResourceProgressRequestDto {
  status: Exclude<ResourceStatus, "not_started">;
  watchedSeconds?: number;
}

/** Resposta do PATCH acima: o estado final, já com a regra de "só avança". */
export interface ResourceProgressDto {
  resourceId: string;
  status: ResourceStatus;
  watchedSeconds: number;
}

/** Anotação livre do usuário em um tópico (GET e PUT .../topics/:topicId/note). */
export interface TopicNoteDto {
  topicId: string;
  content: string;
  /** ISO 8601; nulo enquanto nunca foi salva. */
  updatedAt: string | null;
}

/** Payload de PUT /roadmap/:id/topics/:topicId/note. */
export interface UpdateTopicNoteRequestDto {
  content: string;
}

/** Teto da anotação: texto de estudo, não documento. */
export const TOPIC_NOTE_MAX_LENGTH = 20_000;

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
  /**
   * Primeiro item ainda não concluído, na ordem de estudo: o "continuar de
   * onde parou" do card. Nulo quando o roadmap está completo.
   */
  nextTopic: NextTopicDto | null;
}

export interface NextTopicDto {
  id: string;
  title: string;
  moduleTitle: string;
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

// ---------------------------------------------------------------------------
// Fase 2 — leitor de documentação da MDN dentro do estudeAI.
//
// O conteúdo da MDN é CC-BY-SA 2.5 (atribuição "Mozilla Contributors"). A API
// busca a versão JSON da página, sanitiza o HTML e devolve as seções; o web só
// renderiza. Nada aqui vem de texto livre de IA.
// ---------------------------------------------------------------------------

/** Idiomas que o leitor pede à MDN, em ordem de preferência. */
export const MDN_LOCALES = ["pt-BR", "en-US"] as const;
export type MdnLocale = (typeof MDN_LOCALES)[number];

export interface MdnSectionDto {
  /** Âncora da seção (nula na introdução). */
  id: string | null;
  /** Título em texto puro (nulo na introdução). */
  title: string | null;
  isH3: boolean;
  /** HTML já sanitizado no servidor, com links absolutos. */
  html: string;
}

export interface MdnLinkDto {
  title: string;
  url: string;
}

/** Resposta de GET /docs/mdn?path=... */
export interface MdnArticleDto {
  title: string;
  locale: MdnLocale;
  /** URL pública da página exibida, para o link "ver na MDN". */
  url: string;
  /** URL da versão em inglês, sempre a mais atualizada. */
  englishUrl: string;
  /** true quando é tradução (pode estar atrás do original em inglês). */
  isTranslated: boolean;
  /** ISO 8601 da última modificação da página na MDN. */
  modified: string | null;
  sections: MdnSectionDto[];
  specifications: MdnLinkDto[];
  /** A página tem tabela de compatibilidade (exibida só na MDN). */
  hasBrowserCompat: boolean;
}

/** Endereço (host) da MDN, para reconhecer quais links abrem no leitor. */
export const MDN_HOST = "developer.mozilla.org";

// ---------------------------------------------------------------------------
// Fase 3 — quizzes por tópico.
//
// As perguntas são conteúdo da trilha (curado no JSON e revisado), não do
// usuário. O gabarito NUNCA vai para o cliente antes da resposta: a API corrige
// cada resposta, grava a tentativa e só então devolve a alternativa certa e a
// explicação.
// ---------------------------------------------------------------------------

/** Alternativas por pergunta. */
export const QUIZ_OPTION_COUNT = 4;

/** Fração de acertos a partir da qual o quiz sugere concluir o tópico. */
export const QUIZ_PASS_RATIO = 0.7;

/** Pergunta como o cliente recebe: sem a resposta certa. */
export interface QuizQuestionDto {
  id: string;
  question: string;
  options: string[];
}

/**
 * Situação do quiz para o usuário, pela ÚLTIMA resposta de cada pergunta.
 * Nulo enquanto nenhuma pergunta foi respondida.
 */
export interface QuizSummaryDto {
  total: number;
  answered: number;
  correct: number;
  /** ISO 8601 da resposta mais recente. */
  lastAnsweredAt: string;
}

/** Resposta de GET /roadmap/:id/topics/:topicId/quiz. */
export interface QuizDto {
  topicId: string;
  /** Vazio quando o tópico não tem quiz (a seção some na sala de estudo). */
  questions: QuizQuestionDto[];
  summary: QuizSummaryDto | null;
}

/** Payload de POST /roadmap/:id/topics/:topicId/quiz/answers. */
export interface SubmitQuizAnswerRequestDto {
  questionId: string;
  chosenIndex: number;
}

/** Resposta do POST acima: a correção e a situação atualizada. */
export interface QuizAnswerResultDto {
  questionId: string;
  chosenIndex: number;
  correct: boolean;
  answerIndex: number;
  explanation: string;
  summary: QuizSummaryDto;
}

// ---------------------------------------------------------------------------
// Fase 4 — desafios de código (JS/HTML/CSS/React) com Sandpack.
//
// O código roda no navegador da pessoa, dentro do Sandpack. Os testes também:
// é o cliente que informa se passou. Para estudo individual isso basta — quem
// quiser burlar só engana a si mesmo —, então a API guarda o resultado sem
// tentar reexecutar nada.
// ---------------------------------------------------------------------------

/** Template do Sandpack de cada desafio. */
export const CHALLENGE_TEMPLATES = ["vanilla", "react"] as const;
export type ChallengeTemplate = (typeof CHALLENGE_TEMPLATES)[number];

/** Caminho fixo do arquivo de testes (escondido e só leitura no editor). */
export const CHALLENGE_TEST_FILE = "/exercicio.test.js";

/** Arquivos editáveis do desafio: caminho → conteúdo. */
export type ChallengeFiles = Record<string, string>;

export interface ChallengeDto {
  id: string;
  title: string;
  /** Enunciado; `código` entre crases e parágrafos separados por linha em branco. */
  prompt: string;
  template: ChallengeTemplate;
  /** Código inicial, para o "recomeçar". */
  starterFiles: ChallengeFiles;
  /** Código atual da pessoa (o salvo, ou o inicial se nunca salvou). */
  files: ChallengeFiles;
  /** Conteúdo do arquivo de testes. */
  tests: string;
  passed: boolean;
  /** ISO 8601 da primeira vez que os testes passaram. */
  passedAt: string | null;
}

/** Resposta de GET /roadmap/:id/topics/:topicId/challenges. */
export interface TopicChallengesDto {
  topicId: string;
  /** Vazio quando o tópico não tem desafio (a seção some). */
  challenges: ChallengeDto[];
}

/**
 * Payload de PUT .../challenges/:challengeId. Sem `result`, só salva o código
 * (autosave); com `result`, registra também a execução dos testes.
 */
export interface SaveChallengeRequestDto {
  files: ChallengeFiles;
  result?: "pass" | "fail";
}

export interface ChallengeProgressDto {
  challengeId: string;
  passed: boolean;
  passedAt: string | null;
}

/** Resposta de GET .../challenges/:challengeId/solution. */
export interface ChallengeSolutionDto {
  challengeId: string;
  files: ChallengeFiles;
}

/** Teto de cada arquivo salvo: código de exercício, não projeto. */
export const CHALLENGE_FILE_MAX_LENGTH = 20_000;

// ---------------------------------------------------------------------------
// Fase 5 — evolução do estudante.
//
// O tempo de estudo vem de um aviso por minuto que a sala de estudo manda
// enquanto está visível e em uso; a API soma por dia (no fuso de quem estuda)
// e ignora avisos com menos de 55 s de intervalo, então duas abas não contam
// em dobro. Datas no formato YYYY-MM-DD são sempre o dia LOCAL da pessoa.
// ---------------------------------------------------------------------------

/** Payload de POST /roadmap/:id/study-time. */
export interface StudyTimeRequestDto {
  /** Dia local de quem estuda (YYYY-MM-DD). */
  day: string;
}

export interface StudyDayDto {
  /** YYYY-MM-DD. */
  day: string;
  minutes: number;
}

export interface StudyWeekDto {
  /** Segunda-feira da semana (YYYY-MM-DD). */
  weekStart: string;
  /** Minutos neste roadmap. */
  minutes: number;
  topicsCompleted: number;
}

export interface ModuleQuizStatsDto {
  moduleId: string;
  title: string;
  /** Perguntas com resposta (a última de cada uma conta). */
  answered: number;
  correct: number;
  /** Perguntas que os tópicos do módulo têm, respondidas ou não. */
  total: number;
}

/** Resposta de GET /roadmap/:id/stats?today=YYYY-MM-DD. */
export interface RoadmapStatsDto {
  roadmapId: string;
  /** Dia de referência usado nos cálculos (o "hoje" de quem pediu). */
  today: string;
  /** Minutos por dia, em TODOS os roadmaps da pessoa, só dias com estudo. */
  days: StudyDayDto[];
  /** Dias seguidos com estudo até hoje (ou ontem, se hoje ainda não teve). */
  currentStreak: number;
  bestStreak: number;
  /** Meta do wizard em minutos por semana; nula nos roadmaps antigos. */
  weeklyGoalMinutes: number | null;
  /** Semanas deste roadmap, da mais antiga à atual (8 semanas). */
  weeks: StudyWeekDto[];
  quizByModule: ModuleQuizStatsDto[];
  challenges: { passed: number; total: number };
  /** Horas estimadas do que falta concluir. */
  remainingHours: number;
  /** Média de minutos por semana nas últimas 4 semanas (inclui a atual). */
  recentWeeklyMinutes: number;
  /** Semanas para terminar no ritmo real recente; nulo sem estudo recente. */
  weeksAtRecentPace: number | null;
}

// ---------------------------------------------------------------------------
// Fase 6 — revisão espaçada das perguntas de quiz (FSRS).
//
// Cada resposta de quiz (no tópico ou na revisão) agenda a próxima revisão
// daquela pergunta para a pessoa: acerto empurra para frente (3, 14, 57
// dias...), erro traz de volta no dia seguinte. A fila do dia são os cartões
// com revisão vencida. O gabarito só sai depois da resposta, como no quiz.
// ---------------------------------------------------------------------------

/** Perguntas por sessão de revisão. */
export const REVIEW_SESSION_SIZE = 20;

export interface ReviewItemDto {
  cardId: string;
  question: QuizQuestionDto;
  topic: { id: string; title: string; roadmapId: string };
}

/** Resposta de GET /review/queue. */
export interface ReviewQueueDto {
  /** Cartões vencidos agora (pode ser maior que `items`). */
  dueCount: number;
  /** Até `REVIEW_SESSION_SIZE` cartões, dos mais atrasados primeiro. */
  items: ReviewItemDto[];
  /** Total de perguntas na revisão da pessoa. */
  totalCards: number;
  /** ISO 8601 da próxima revisão futura; nulo se não há. */
  nextDueAt: string | null;
}

/** Payload de POST /review/:cardId/answer. */
export interface SubmitReviewAnswerRequestDto {
  chosenIndex: number;
}

/** Resposta do POST acima. */
export interface ReviewAnswerResultDto {
  cardId: string;
  chosenIndex: number;
  correct: boolean;
  answerIndex: number;
  explanation: string;
  /** ISO 8601 de quando a pergunta volta. */
  nextReviewAt: string;
}
