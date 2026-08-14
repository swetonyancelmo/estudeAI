import type {
  Affinity,
  LearningGoal,
  LearningStyle,
  WeeklyTime,
  WizardAnswers,
} from "@estudeai/shared-types";

/**
 * Configuração declarativa do wizard (FR-01.1: uma pergunta por tela).
 * Cada step mapeia para exatamente um campo de WizardAnswers; renderização,
 * navegação e barra de progresso derivam deste array — sem lógica por-tela.
 */
export interface StepOption<V extends string> {
  value: V;
  label: string;
  hint: string;
}

interface StepConfig<K extends keyof WizardAnswers> {
  /** Chave do campo em WizardAnswers — também usada como key de animação. */
  field: K;
  title: string;
  subtitle: string;
  options: ReadonlyArray<StepOption<WizardAnswers[K]>>;
}

// Tipa cada entrada com sua própria chave sem alargar para a união toda.
function step<K extends keyof WizardAnswers>(config: StepConfig<K>): StepConfig<K> {
  return config;
}

export const WIZARD_STEPS = [
  step<"goal">({
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
        hint: "Tirar uma ideia/startup do papel por conta própria.",
      },
    ],
  }),
  step<"weeklyTime">({
    field: "weeklyTime",
    title: "Quanto tempo você tem por semana?",
    subtitle: "Usamos isso para dimensionar a carga de cada tópico.",
    options: [
      { value: "5h" satisfies WeeklyTime, label: "Cerca de 5h", hint: "Ritmo leve, encaixando nos intervalos." },
      { value: "15h" satisfies WeeklyTime, label: "Cerca de 15h", hint: "Ritmo consistente durante a semana." },
      { value: "30h+" satisfies WeeklyTime, label: "30h ou mais", hint: "Dedicação intensiva / tempo integral." },
    ],
  }),
  step<"affinity">({
    field: "affinity",
    title: "Com o que você mais se identifica?",
    subtitle: "Não existe resposta errada — é só a sua preferência.",
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
    ],
  }),
  step<"learningStyle">({
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
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;
