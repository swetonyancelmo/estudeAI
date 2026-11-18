import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CHALLENGE_FILE_MAX_LENGTH,
  type ChallengeFiles,
  type ChallengeProgressDto,
  type ChallengeSolutionDto,
  type SaveChallengeRequestDto,
  type TopicChallengesDto,
} from '@estudeai/shared-types';
import { TrackChallenge } from '../tracks/entities/track-challenge.entity';
import { ChallengeProgress } from './entities/challenge-progress.entity';
import type { Topic } from './entities/topic.entity';
import { UserRoadmapService } from './user-roadmap.service';

/**
 * Grava código e resultado de um desafio, criando a linha na primeira vez.
 * `passed` só avança (OR com o que já estava), `passed_at` guarda a PRIMEIRA
 * vez que passou e `runs` soma as execuções informadas.
 */
const UPSERT_PROGRESS_SQL = `
  INSERT INTO "challenge_progress"
    ("user_id", "roadmap_topic_id", "challenge_id", "files", "passed", "passed_at", "runs")
  VALUES ($1, $2, $3, $4::jsonb, $5, CASE WHEN $5 THEN now() END, $6)
  ON CONFLICT ("roadmap_topic_id", "challenge_id") DO UPDATE SET
    "files" = EXCLUDED."files",
    "passed" = "challenge_progress"."passed" OR EXCLUDED."passed",
    "passed_at" = COALESCE("challenge_progress"."passed_at", EXCLUDED."passed_at"),
    "runs" = "challenge_progress"."runs" + EXCLUDED."runs",
    "updated_at" = now()
  RETURNING "passed", "passed_at"
`;

/**
 * Desafios de código da sala de estudo (Fase 4).
 *
 * Como no quiz, os desafios vêm do tópico da TRILHA de onde o tópico do
 * usuário nasceu. O código roda e é testado no navegador (Sandpack): esta
 * camada só guarda o código da pessoa e o resultado que o cliente informa.
 * Para estudo individual isso basta — burlar o resultado só engana quem burla.
 */
@Injectable()
export class ChallengeService {
  constructor(
    private readonly userRoadmaps: UserRoadmapService,
    @InjectRepository(TrackChallenge)
    private readonly challenges: Repository<TrackChallenge>,
    @InjectRepository(ChallengeProgress)
    private readonly progress: Repository<ChallengeProgress>,
  ) {}

  async list(
    userId: string,
    roadmapId: string,
    topicId: string,
  ): Promise<TopicChallengesDto> {
    const topic = await this.userRoadmaps.loadOwnedTopic(
      userId,
      roadmapId,
      topicId,
    );
    const challenges = await this.challengesOf(topic);
    const saved =
      challenges.length === 0
        ? []
        : await this.progress.find({
            where: {
              roadmapTopicId: topic.id,
              challengeId: In(challenges.map((challenge) => challenge.id)),
            },
          });
    const byChallenge = new Map(saved.map((row) => [row.challengeId, row]));

    return {
      topicId: topic.id,
      challenges: challenges.map((challenge) => {
        const row = byChallenge.get(challenge.id);
        return {
          id: challenge.id,
          title: challenge.title,
          prompt: challenge.prompt,
          template: challenge.template,
          starterFiles: challenge.files,
          // Arquivo novo no desafio aparece mesmo para quem já tinha salvo.
          files: { ...challenge.files, ...(row?.files ?? {}) },
          tests: challenge.tests,
          passed: row?.passed ?? false,
          passedAt: row?.passedAt ? row.passedAt.toISOString() : null,
        };
      }),
    };
  }

  /**
   * Salva o código da pessoa e, se veio `result`, a execução dos testes.
   * `passed` só avança: depois de resolvido, uma execução que falha (a pessoa
   * mexendo no código) não desfaz o "resolvido".
   */
  async save(
    userId: string,
    roadmapId: string,
    topicId: string,
    challengeId: string,
    { files, result }: SaveChallengeRequestDto,
  ): Promise<ChallengeProgressDto> {
    const topic = await this.userRoadmaps.loadOwnedTopic(
      userId,
      roadmapId,
      topicId,
    );
    const challenge = await this.findInTopic(topic, challengeId);
    const cleanFiles = this.validFiles(challenge, files);

    const passedNow = result === 'pass';
    // Uma instrução só: o editor dispara salvamentos quase simultâneos (o
    // resultado da primeira execução e o autosave), e um "busca, depois
    // insere" em duas idas ao banco quebrava a restrição de unicidade.
    // As regras de "só avança" ficam no próprio SQL pelo mesmo motivo.
    const rows: { passed: boolean; passed_at: Date | null }[] =
      await this.progress.query(UPSERT_PROGRESS_SQL, [
        userId,
        topic.id,
        challenge.id,
        JSON.stringify(cleanFiles),
        passedNow,
        result ? 1 : 0,
      ]);
    const saved = rows[0];

    return {
      challengeId: challenge.id,
      passed: saved.passed,
      passedAt: saved.passed_at
        ? new Date(saved.passed_at).toISOString()
        : null,
    };
  }

  async solution(
    userId: string,
    roadmapId: string,
    topicId: string,
    challengeId: string,
  ): Promise<ChallengeSolutionDto> {
    const topic = await this.userRoadmaps.loadOwnedTopic(
      userId,
      roadmapId,
      topicId,
    );
    const challenge = await this.findInTopic(topic, challengeId);
    return {
      challengeId: challenge.id,
      files: { ...challenge.files, ...challenge.solution },
    };
  }

  private async challengesOf(topic: Topic): Promise<TrackChallenge[]> {
    if (!topic.trackTopicId) return [];
    return this.challenges.find({
      where: { trackTopicId: topic.trackTopicId },
      order: { order: 'ASC' },
    });
  }

  private async findInTopic(
    topic: Topic,
    challengeId: string,
  ): Promise<TrackChallenge> {
    const challenge = (await this.challengesOf(topic)).find(
      (candidate) => candidate.id === challengeId,
    );
    if (!challenge) {
      throw new NotFoundException('Desafio não encontrado neste tópico.');
    }
    return challenge;
  }

  /**
   * Só os arquivos editáveis do próprio desafio, como texto e dentro do teto.
   * O arquivo de testes nunca é salvo: ele vem sempre do conteúdo da trilha.
   */
  private validFiles(
    challenge: TrackChallenge,
    files: ChallengeFiles,
  ): ChallengeFiles {
    const entries = Object.entries(files ?? {});
    if (entries.length === 0) {
      throw new BadRequestException('Envie ao menos um arquivo.');
    }
    for (const [path, code] of entries) {
      if (!(path in challenge.files)) {
        throw new BadRequestException(`Arquivo inesperado: ${path}`);
      }
      if (typeof code !== 'string' || code.length > CHALLENGE_FILE_MAX_LENGTH) {
        throw new BadRequestException(
          `Cada arquivo deve ter no máximo ${CHALLENGE_FILE_MAX_LENGTH} caracteres.`,
        );
      }
    }
    return Object.fromEntries(entries);
  }
}
