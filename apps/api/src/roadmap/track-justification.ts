import type {
  KnownSkill,
  TargetArea,
  WizardAnswers,
} from '@estudeai/shared-types';

/**
 * Justificativa da trilha escolhida (docs/TRILHAS.md §6): os fatos que a
 * sustentam, o texto montado por regra e o prompt do Gemini.
 *
 * O texto por regra não é um plano B envergonhado — é o piso. O Gemini só
 * reescreve os MESMOS fatos com mais naturalidade; se ele falhar, demorar ou
 * devolver algo estranho, a pessoa recebe este texto e nem fica sabendo.
 */

/** Números do roadmap já recortado, para a justificativa não inventar nenhum. */
export interface JustificationFacts {
  area: TargetArea;
  /** false = a regra escolheu por ela (respondeu "ainda não sei"). */
  areaChosenByUser: boolean;
  moduleCount: number;
  topicCount: number;
  /** Tópicos que nascem concluídos pelas habilidades declaradas. */
  knownTopicCount: number;
}

export const AREA_NAMES: Record<TargetArea, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  fullstack: 'Fullstack',
  devops: 'DevOps',
};

const GOAL_TEXT: Record<WizardAnswers['goal'], string> = {
  mercado: 'entrar no mercado como desenvolvedor(a)',
  startup: 'construir o seu próprio produto',
};

const AFFINITY_TEXT: Record<NonNullable<WizardAnswers['affinity']>, string> = {
  visual: 'interface e experiência visual',
  logica: 'lógica e dados',
  infra: 'infraestrutura e automação',
};

const WEEKLY_TIME_TEXT: Record<WizardAnswers['weeklyTime'], string> = {
  '5h': 'cerca de 5 horas por semana',
  '15h': 'cerca de 15 horas por semana',
  '30h+': '30 horas ou mais por semana',
};

const DEPTH_TEXT: Record<WizardAnswers['weeklyTime'], string> = {
  '5h': 'o roteiro ficou enxuto, só com o essencial',
  '15h': 'o roteiro traz o essencial e parte dos aprofundamentos',
  '30h+': 'o roteiro traz a trilha completa, com todos os aprofundamentos',
};

const STYLE_TEXT: Record<WizardAnswers['learningStyle'], string> = {
  pratico:
    'Como você aprende melhor na prática, apoie-se nos projetos ao longo do caminho.',
  teorico:
    'Como você prefere entender os fundamentos, os artigos e a documentação aparecem primeiro em cada tópico.',
  audiovisual:
    'Como você aprende melhor com vídeo, as aulas em vídeo aparecem primeiro em cada tópico.',
};

export const SKILL_NAMES: Record<KnownSkill, string> = {
  'logica-programacao': 'lógica de programação',
  'html-css': 'HTML e CSS',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  git: 'Git',
  'terminal-linux': 'terminal Linux',
  sql: 'SQL',
  'http-apis': 'HTTP e APIs',
  react: 'React',
  nodejs: 'Node.js',
  docker: 'Docker',
  cloud: 'nuvem',
};

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Texto determinístico: mesmas respostas, mesma justificativa. */
export function buildRuleJustification(
  answers: WizardAnswers,
  facts: JustificationFacts,
): string {
  const area = AREA_NAMES[facts.area];
  const goal = GOAL_TEXT[answers.goal];

  const why =
    facts.areaChosenByUser || !answers.affinity
      ? `Você escolheu a trilha de ${area}, e ela serve bem ao seu objetivo de ${goal}.`
      : `Pela sua afinidade com ${AFFINITY_TEXT[answers.affinity]} e pelo seu objetivo de ${goal}, a trilha de ${area} é a que mais combina com você.`;

  const size = `Com ${WEEKLY_TIME_TEXT[answers.weeklyTime]}, ${DEPTH_TEXT[answers.weeklyTime]}: ${plural(facts.topicCount, 'tópico', 'tópicos')} em ${plural(facts.moduleCount, 'módulo', 'módulos')}.`;

  const known =
    facts.knownTopicCount > 0
      ? ` Pelo que você já sabe, ${plural(facts.knownTopicCount, 'tópico já começa concluído', 'tópicos já começam concluídos')}; desmarque o que quiser revisar.`
      : '';

  return `${why} ${size}${known} ${STYLE_TEXT[answers.learningStyle]}`;
}

export const JUSTIFICATION_SYSTEM_INSTRUCTION = `Você é um mentor de carreira em desenvolvimento de software. A trilha de estudos do estudante JÁ FOI ESCOLHIDA e montada; sua única tarefa é escrever a explicação de por que ela combina com ele.

Regras:
- Português do Brasil, de 2 a 4 frases, tom direto e encorajador, falando com "você".
- Cite o objetivo, o tempo semanal e o estilo de aprendizado informados. Se houver habilidades já dominadas, mencione que parte do roteiro já começa concluída.
- Use SOMENTE os fatos e números fornecidos. Não invente tecnologias, prazos, salários nem promessas de emprego.
- Não sugira outra trilha nem questione a escolha.
- Responda apenas com o texto: sem título, sem lista, sem markdown, sem aspas.`;

export function buildJustificationPrompt(
  answers: WizardAnswers,
  facts: JustificationFacts,
): string {
  const skills =
    answers.knownSkills.length > 0
      ? answers.knownSkills.map((skill) => SKILL_NAMES[skill]).join(', ')
      : 'nenhuma (começando do zero)';

  return [
    'Dados do estudante e do roadmap montado:',
    `- Trilha: ${AREA_NAMES[facts.area]} (${
      facts.areaChosenByUser
        ? 'escolhida pelo próprio estudante'
        : `indicada pela afinidade com ${
            answers.affinity ? AFFINITY_TEXT[answers.affinity] : 'a área'
          }`
    })`,
    `- Objetivo: ${GOAL_TEXT[answers.goal]}`,
    `- Tempo disponível: ${WEEKLY_TIME_TEXT[answers.weeklyTime]}`,
    `- Estilo de aprendizado: ${answers.learningStyle}`,
    `- Habilidades que já domina: ${skills}`,
    `- Roteiro: ${facts.topicCount} tópicos em ${facts.moduleCount} módulos (${DEPTH_TEXT[answers.weeklyTime]})`,
    `- Tópicos que já começam concluídos: ${facts.knownTopicCount}`,
  ].join('\n');
}

const MIN_LENGTH = 60;
const MAX_LENGTH = 700;

/**
 * Aceita a resposta do modelo só se ela parecer o que foi pedido: texto corrido
 * de tamanho razoável. Qualquer outra coisa (vazio, parede de texto, markdown)
 * devolve `null` e quem chama usa o texto por regra.
 */
export function sanitizeJustification(raw: string | undefined): string | null {
  const text = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) {
    return null;
  }
  if (/[*#`]|^\s*[-•]/.test(text)) {
    return null;
  }
  return text;
}
