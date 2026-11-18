/**
 * Geração dos quizzes das trilhas (Fase 3).
 *
 *   pnpm quiz:curate frontend            # tópicos ainda sem `quiz`
 *   pnpm quiz:curate frontend --force    # refaz todos
 *   pnpm quiz:curate frontend --limit 5  # só os 5 primeiros pendentes
 *
 * O Gemini escreve cada pergunta como enunciado + resposta certa + 3 erradas
 * + explicação. A POSIÇÃO da certa é decidida aqui, não pela IA: nas 4
 * perguntas de um tópico ela cai uma vez em cada letra, então não existe
 * "chute na B". Perguntas que quebram as regras (certa repetida nas erradas,
 * alternativa vazia ou duplicada, "todas as anteriores") são descartadas e o
 * tópico é pedido de novo.
 *
 * Grava só o bloco `quiz` de cada tópico no JSON. Revise antes de commitar.
 */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import { QUIZ_OPTION_COUNT } from '@estudeai/shared-types';
import {
  TRACK_SLUGS,
  validateTrackContent,
  type TrackContent,
  type TrackModuleContent,
  type TrackQuizQuestionContent,
  type TrackSlug,
  type TrackTopicContent,
} from '../src/tracks/track-content';
import { generateJson, sleep } from './gemini-json';
import { assertSameContent, setTopicQuiz } from './track-json-docs';

const CONTENT_DIR = join(__dirname, '..', 'src', 'tracks', 'content');
const QUESTIONS_PER_TOPIC = 4;
/** Pedimos mais do que usamos: as regras descartam parte das perguntas. */
const DRAFTS_PER_CALL = 6;
const MAX_TRIES_PER_TOPIC = 4;
/** A certa pode passar a maior errada em até 10%, não mais. */
const MAX_CORRECT_LENGTH_RATIO = 1.1;
/** Quantas perguntas do tópico podem ter a certa como a alternativa mais longa. */
const MAX_LONGEST_CORRECT_PER_TOPIC = 1;
const DELAY_MS = 1_500;
const MAX_TEXT = 300;

const SYSTEM_INSTRUCTION = `Você escreve exercícios de múltipla escolha para uma plataforma brasileira de estudos de programação.
Para o tópico recebido, escreva exatamente ${DRAFTS_PER_CALL} perguntas em português do Brasil.
Regras:
- Cada pergunta testa ENTENDIMENTO de um ponto central do tópico, não decoreba de nome ou data. Cubra pontos diferentes do tópico.
- Ajuste a dificuldade ao nível informado (iniciante, intermediário, avançado).
- Exatamente UMA resposta certa, sem ambiguidade. As 3 erradas são plausíveis: confusões e erros comuns de quem está aprendendo.
- As alternativas têm tamanho e estilo parecidos. A certa NÃO pode ser a mais longa nem a mais detalhada: escreva-a com tamanho igual ou menor que pelo menos uma das erradas.
- Cada alternativa errada precisa parecer certa para quem ainda não domina o assunto. Nada de alternativas absurdas, exageradas ou engraçadas.
- Proibido: "todas as anteriores", "nenhuma das anteriores", pegadinhas e negação dupla.
- Código curto pode aparecer entre crases, como \`fetch(url)\`. Nada de blocos de várias linhas.
- Enunciado e alternativas com no máximo ${MAX_TEXT} caracteres.
- "explanation": 1 ou 2 frases dizendo por que a resposta certa está certa, e, se ajudar, o erro mais comum.`;

interface DraftQuestion {
  question: string;
  correct: string;
  wrong: string[];
  explanation: string;
}

function parseArgs() {
  const [track, ...rest] = process.argv.slice(2);
  if (!TRACK_SLUGS.includes(track as TrackSlug)) {
    throw new Error(
      `Uso: pnpm quiz:curate <${TRACK_SLUGS.join('|')}> [--force] [--limit N]`,
    );
  }
  const limitIndex = rest.indexOf('--limit');
  return {
    track: track as TrackSlug,
    force: rest.includes('--force'),
    limit: limitIndex >= 0 ? Number(rest[limitIndex + 1]) : Infinity,
  };
}

/** Motivo da recusa de uma pergunta, ou nulo se está boa. */
function problemOf(draft: DraftQuestion): string | null {
  const texts = [
    draft.question,
    draft.correct,
    ...draft.wrong,
    draft.explanation,
  ];
  if (draft.wrong.length !== QUIZ_OPTION_COUNT - 1) return 'número de erradas';
  if (texts.some((text) => typeof text !== 'string' || text.trim() === '')) {
    return 'texto vazio';
  }
  if (texts.some((text) => text.length > MAX_TEXT + 100)) return 'texto longo';
  const options = [draft.correct, ...draft.wrong].map((o) =>
    o.trim().toLowerCase(),
  );
  if (new Set(options).size !== options.length) return 'alternativas repetidas';
  if (
    options.some((o) => /(todas|nenhuma) das (anteriores|alternativas)/.test(o))
  ) {
    return '"todas/nenhuma das anteriores"';
  }
  // A certa não pode se entregar por ser a mais longa com folga.
  const longestWrong = Math.max(...draft.wrong.map((o) => o.trim().length));
  if (draft.correct.trim().length > longestWrong * MAX_CORRECT_LENGTH_RATIO) {
    return 'certa bem mais longa que as erradas';
  }
  return null;
}

/** true se a certa é estritamente a alternativa mais longa. */
function correctIsLongest(question: TrackQuizQuestionContent): boolean {
  const correct = question.options[question.answerIndex].length;
  return question.options.every(
    (option, index) =>
      index === question.answerIndex || option.length < correct,
  );
}

/**
 * Motivo para refazer um quiz já gravado pelas regras ATUAIS, ou nulo. Assim
 * uma regra nova se aplica ao que já foi gerado, sem `--force` (que refaria
 * também os quizzes bons e gastaria cota à toa).
 */
function quizProblem(
  quiz: TrackQuizQuestionContent[] | undefined,
): string | null {
  if (!quiz || quiz.length === 0) return 'sem quiz';
  const tooLong = quiz.find((question) => {
    const wrong = question.options.filter((_, i) => i !== question.answerIndex);
    const longestWrong = Math.max(...wrong.map((o) => o.length));
    return (
      question.options[question.answerIndex].length >
      longestWrong * MAX_CORRECT_LENGTH_RATIO
    );
  });
  if (tooLong) return `certa bem mais longa em "${tooLong.id}"`;
  if (quiz.filter(correctIsLongest).length > MAX_LONGEST_CORRECT_PER_TOPIC) {
    return 'certa é a mais longa em mais de uma pergunta';
  }
  return null;
}

/**
 * Escolhe as perguntas do tópico entre as aprovadas, na ordem em que vieram,
 * aceitando no máximo `MAX_LONGEST_CORRECT_PER_TOPIC` em que a certa é a
 * alternativa mais longa.
 */
function pickDrafts(good: DraftQuestion[]): DraftQuestion[] {
  const picked: DraftQuestion[] = [];
  let longest = 0;
  for (const draft of good) {
    if (picked.length === QUESTIONS_PER_TOPIC) break;
    const isLongest = draft.wrong.every(
      (option) => option.trim().length < draft.correct.trim().length,
    );
    if (isLongest && longest >= MAX_LONGEST_CORRECT_PER_TOPIC) continue;
    if (isLongest) longest++;
    picked.push(draft);
  }
  return picked;
}

/**
 * Posição da resposta certa na pergunta `index` do tópico: uma permutação das
 * 4 letras embaralhada pelo slug (Fisher-Yates com os bytes do hash). Cada
 * letra aparece uma vez por tópico, sem sequência previsível (A, B, C, D), e o
 * resultado é sempre o mesmo para o mesmo tópico.
 */
function answerPosition(slug: string, index: number): number {
  const bytes = createHash('sha256').update(slug).digest();
  const order = Array.from({ length: QUIZ_OPTION_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order[index % QUIZ_OPTION_COUNT];
}

function toQuestion(
  slug: string,
  index: number,
  draft: DraftQuestion,
): TrackQuizQuestionContent {
  const answerIndex = answerPosition(slug, index);
  const options = draft.wrong.map((option) => option.trim());
  options.splice(answerIndex, 0, draft.correct.trim());
  return {
    id: `${slug}-${index + 1}`,
    question: draft.question.trim(),
    options,
    answerIndex,
    explanation: draft.explanation.trim(),
  };
}

async function draftQuiz(
  ai: GoogleGenAI,
  track: TrackContent,
  module: TrackModuleContent,
  topic: TrackTopicContent,
): Promise<DraftQuestion[]> {
  const docs = (topic.docs ?? []).map((doc) => `- ${doc.title}`).join('\n');
  const prompt = [
    `Trilha: ${track.title}`,
    `Módulo: ${module.title}`,
    `Tópico: ${topic.title}`,
    `Nível: ${topic.level}`,
    docs ? `Documentação que a pessoa estudou:\n${docs}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const parsed = await generateJson<{ questions?: DraftQuestion[] }>(ai, {
    systemInstruction: SYSTEM_INSTRUCTION,
    prompt,
    temperature: 0.4,
    schema: {
      type: Type.OBJECT,
      properties: {
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              correct: { type: Type.STRING },
              wrong: { type: Type.ARRAY, items: { type: Type.STRING } },
              explanation: { type: Type.STRING },
            },
            required: ['question', 'correct', 'wrong', 'explanation'],
          },
        },
      },
      required: ['questions'],
    },
  });
  return parsed.questions ?? [];
}

async function main() {
  const { track, force, limit } = parseArgs();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY ausente no .env da API.');
  const ai = new GoogleGenAI({ apiKey });

  const file = join(CONTENT_DIR, `${track}.json`);
  const content = JSON.parse(readFileSync(file, 'utf8')) as TrackContent;

  const pending = content.modules.flatMap((module) =>
    module.topics
      .filter((topic) => force || quizProblem(topic.quiz) !== null)
      .map((topic) => ({ module, topic })),
  );
  const batch = pending.slice(0, limit);
  console.log(
    `Trilha ${track}: ${batch.length} de ${pending.length} tópico(s) pendente(s).\n`,
  );

  let written = 0;
  const failed: string[] = [];

  for (const [index, { module, topic }] of batch.entries()) {
    if (index > 0) await sleep(DELAY_MS);
    console.log(`• ${topic.title}`);

    let quiz: TrackQuizQuestionContent[] | null = null;
    for (let attempt = 1; attempt <= MAX_TRIES_PER_TOPIC && !quiz; attempt++) {
      let drafts: DraftQuestion[];
      try {
        drafts = await draftQuiz(ai, content, module, topic);
      } catch (error) {
        console.log(
          `  ✗ Gemini falhou: ${String(error).slice(0, 160)} — parando aqui.`,
        );
        return finish(written, failed, track);
      }
      const good = drafts.filter((draft) => {
        const problem = problemOf(draft);
        if (problem)
          console.log(
            `  ✗ descartada (${problem}): ${draft.question?.slice(0, 80)}`,
          );
        return !problem;
      });
      const picked = pickDrafts(good);
      if (picked.length >= QUESTIONS_PER_TOPIC) {
        const candidate = picked.map((draft, position) =>
          toQuestion(topic.slug, position, draft),
        );
        const problem = quizProblem(candidate);
        if (problem) {
          console.log(`  … quiz recusado (${problem}), pedindo de novo`);
        } else {
          quiz = candidate;
        }
      } else {
        console.log(
          `  … só ${good.length} pergunta(s) boa(s), pedindo de novo`,
        );
      }
    }

    if (!quiz) {
      failed.push(topic.title);
      continue;
    }

    topic.quiz = quiz;
    // Valida a trilha inteira antes de gravar: nada inválido chega ao arquivo.
    validateTrackContent(content, track);
    const text = setTopicQuiz(readFileSync(file, 'utf8'), topic.slug, quiz);
    assertSameContent(text, content);
    writeFileSync(file, text);
    written++;
    console.log(`  ✓ ${quiz.length} perguntas`);
  }

  finish(written, failed, track);
}

function finish(written: number, failed: string[], track: string) {
  console.log(`\nTópicos com quiz novo: ${written}`);
  if (failed.length > 0) {
    console.log(
      `Sem quiz válido (${failed.length}):\n- ${failed.join('\n- ')}`,
    );
  }
  console.log(
    `\nRevise o diff de src/tracks/content/${track}.json antes de commitar.`,
  );
}

main()
  // Conexões abertas do SDK seguram o processo vivo: sai ao terminar.
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
