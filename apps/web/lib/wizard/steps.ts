import {
  UNDECIDED_AREA,
  type Affinity,
  type KnownSkill,
  type LearningGoal,
  type LearningStyle,
  type WeeklyTime,
  type WizardAnswers,
  type WizardArea,
} from "@estudeai/shared-types";

/**
 * Configuração declarativa do wizard (FR-01.1: uma pergunta por tela).
 * Cada step mapeia para exatamente um campo de WizardAnswers; renderização,
 * navegação e barra de progresso derivam deste array — sem lógica por-tela.
 *
 * Dois formatos de pergunta: `single` (uma opção, avança sozinho) e `multi`
 * (várias opções, com uma saída explícita "nenhuma"). Um step pode ser
 * condicional (`when`): o caminho de quem já sabe a área tem uma pergunta a
 * menos — por isso quem consome usa `visibleSteps`, nunca o array cru.
 */
/** Nome curto de cada parada do diagnóstico (landing e linha do wizard). */
export const STEP_SHORT_LABELS: Record<keyof WizardAnswers, string> = {
  goal: "Objetivo",
  area: "Área",
  affinity: "Afinidade",
  knownSkills: "Bagagem",
  weeklyTime: "Tempo",
  learningStyle: "Estilo",
};

export interface StepOption<V extends string> {
  value: V;
  label: string;
  hint: string;
}

/** Campos de escolha única — todos menos a lista de habilidades. */
export type SingleField = Exclude<keyof WizardAnswers, "knownSkills">;

interface StepBase {
  title: string;
  subtitle: string;
  /** Aviso curto para a landing, quando a pergunta não é feita a todo mundo. */
  note?: string;
  /** Ausente = sempre aparece. */
  when?: (answers: Partial<WizardAnswers>) => boolean;
}

export interface SingleStepConfig<K extends SingleField = SingleField>
  extends StepBase {
  kind: "single";
  /** Chave do campo em WizardAnswers — também usada como key de animação. */
  field: K;
  options: ReadonlyArray<StepOption<NonNullable<WizardAnswers[K]>>>;
}

export interface MultiStepConfig extends StepBase {
  kind: "multi";
  field: "knownSkills";
  options: ReadonlyArray<StepOption<KnownSkill>>;
  /** A resposta "nenhuma": limpa a seleção e ainda conta como respondida. */
  none: { label: string; hint: string };
}

export type WizardStepConfig = SingleStepConfig | MultiStepConfig;

// Tipa cada entrada com sua própria chave sem alargar para a união toda.
function single<K extends SingleField>(
  config: Omit<SingleStepConfig<K>, "kind">,
): SingleStepConfig<K> {
  return { kind: "single", ...config };
}

export const WIZARD_STEPS = [
  single<"goal">({
    field: "goal",
    title: "Qual é o seu objetivo?",
    subtitle: "Isso ajuda a calibrar o foco do seu roadmap.",
    options: [
      {
        value: "mercado" satisfies LearningGoal,
        label: "Entrar no mercado",
        hint: "Conseguir uma vaga como desenvolvedor(a).",
      },
      {
        value: "startup" satisfies LearningGoal,
        label: "Construir meu produto",
        hint: "Tirar uma ideia do papel por conta própria.",
      },
    ],
  }),
  single<"area">({
    field: "area",
    title: "Já sabe qual área quer seguir?",
    subtitle: "Se ainda não sabe, tudo bem: a gente descobre com você.",
    options: [
      {
        value: "frontend" satisfies WizardArea,
        label: "Frontend",
        hint: "O que as pessoas veem e usam: páginas e interfaces.",
      },
      {
        value: "backend" satisfies WizardArea,
        label: "Backend",
        hint: "O que roda por trás: regras, dados e APIs.",
      },
      {
        value: "fullstack" satisfies WizardArea,
        label: "Fullstack",
        hint: "As duas pontas, para construir o produto inteiro.",
      },
      {
        value: "devops" satisfies WizardArea,
        label: "DevOps",
        hint: "Servidores, automação e colocar sistemas no ar.",
      },
      {
        value: UNDECIDED_AREA satisfies WizardArea,
        label: "Ainda não sei",
        hint: "Uma pergunta a mais e a gente indica a trilha.",
      },
    ],
  }),
  single<"affinity">({
    field: "affinity",
    title: "Com o que você mais se identifica?",
    subtitle: "Não existe resposta errada, é só a sua preferência.",
    note: "Só para quem ainda não sabe a área.",
    when: (answers) => answers.area === UNDECIDED_AREA,
    options: [
      {
        value: "visual" satisfies Affinity,
        label: "Interface e visual",
        hint: "Layouts, design e a experiência que o usuário vê.",
      },
      {
        value: "logica" satisfies Affinity,
        label: "Lógica e dados",
        hint: "Regras de negócio, algoritmos e o que roda por trás.",
      },
      {
        value: "infra" satisfies Affinity,
        label: "Infraestrutura",
        hint: "Servidores, redes e automatizar o que é repetitivo.",
      },
    ],
  }),
  {
    kind: "multi",
    field: "knownSkills",
    title: "O que você já sabe?",
    subtitle:
      "Marque o que você já domina. Esses tópicos já entram concluídos no seu roadmap.",
    none: {
      label: "Estou começando do zero",
      hint: "Sem problema: a trilha parte do básico.",
    },
    options: [
      { value: "logica-programacao", label: "Lógica de programação", hint: "Resolve exercícios com variáveis, condições, laços e funções." },
      { value: "html-css", label: "HTML e CSS", hint: "Monta uma página com HTML semântico e layout responsivo em CSS." },
      { value: "javascript", label: "JavaScript", hint: "Escreve funções, manipula arrays e objetos e usa async/await." },
      { value: "typescript", label: "TypeScript", hint: "Tipa props, funções e objetos sem recorrer a any." },
      { value: "git", label: "Git", hint: "Faz commit, branch e pull request sem consultar." },
      { value: "terminal-linux", label: "Terminal Linux", hint: "Navega em pastas, edita arquivos e roda comandos sem interface gráfica." },
      { value: "sql", label: "SQL", hint: "Escreve SELECT com JOIN, filtros e agrupamentos." },
      { value: "http-apis", label: "HTTP e APIs", hint: "Entende métodos, status e consome uma API REST com JSON." },
      { value: "react", label: "React", hint: "Cria componentes com estado, props e efeitos." },
      { value: "nodejs", label: "Node.js", hint: "Sobe um servidor HTTP com rotas e lê variáveis de ambiente." },
      { value: "docker", label: "Docker", hint: "Escreve um Dockerfile e sobe serviços com docker compose." },
      { value: "cloud", label: "Nuvem", hint: "Já publicou uma aplicação num provedor de nuvem." },
    ],
  } satisfies MultiStepConfig,
  single<"weeklyTime">({
    field: "weeklyTime",
    title: "Quanto tempo você tem por semana?",
    subtitle: "Com menos tempo o roadmap fica mais enxuto, só com o essencial.",
    options: [
      { value: "5h" satisfies WeeklyTime, label: "Cerca de 5h", hint: "Ritmo leve, encaixando nos intervalos." },
      { value: "15h" satisfies WeeklyTime, label: "Cerca de 15h", hint: "Ritmo consistente durante a semana." },
      { value: "30h+" satisfies WeeklyTime, label: "30h ou mais", hint: "Dedicação intensiva, quase tempo integral." },
    ],
  }),
  single<"learningStyle">({
    field: "learningStyle",
    title: "Como você aprende melhor?",
    subtitle: "Vamos priorizar recursos no formato que mais te ajuda.",
    options: [
      {
        value: "pratico" satisfies LearningStyle,
        label: "Mão na massa",
        hint: "Aprendo construindo projetos e praticando.",
      },
      {
        value: "teorico" satisfies LearningStyle,
        label: "Teórico",
        hint: "Prefiro entender os fundamentos e ler a documentação.",
      },
      {
        value: "audiovisual" satisfies LearningStyle,
        label: "Audiovisual",
        hint: "Absorvo melhor com vídeo-aulas e demonstrações.",
      },
    ],
  }),
] as const satisfies ReadonlyArray<WizardStepConfig>;

/** As perguntas que ESTA pessoa vai responder, dadas as respostas até aqui. */
export function visibleSteps(
  answers: Partial<WizardAnswers>,
): ReadonlyArray<WizardStepConfig> {
  return WIZARD_STEPS.filter(
    (step: WizardStepConfig) => !step.when || step.when(answers),
  );
}

/** Rótulo da opção de um campo de escolha única ("Entrar no mercado"…). */
export function optionLabel<K extends SingleField>(
  field: K,
  value: WizardAnswers[K],
): string {
  const step = WIZARD_STEPS.find(
    (candidate: WizardStepConfig) => candidate.field === field,
  );
  return step?.options.find((option) => option.value === value)?.label ?? "";
}
