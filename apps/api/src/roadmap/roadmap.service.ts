import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  UNDECIDED_AREA,
  type RoadmapDetailDto,
  type WizardAnswers,
} from '@estudeai/shared-types';
import { Track } from '../tracks/entities/track.entity';
import { personalizeTrack } from '../tracks/track-personalization';
import { chooseTrack } from '../tracks/track-selection';
import {
  parseYoutubeVideoId,
  youtubeThumbnailUrl,
} from '../tracks/youtube-video-url';
import { TrackJustificationService } from './track-justification.service';
import { UserRoadmapService } from './user-roadmap.service';

/**
 * Orquestra a geração do roadmap (FR-01 / FR-02), agora a partir das trilhas
 * curadas (docs/TRILHAS.md):
 *
 *  1. as respostas escolhem a trilha (regra fixa);
 *  2. a trilha é recortada para a pessoa (tempo semanal + o que ela já sabe),
 *     e cada módulo que sobra ganha o seu projeto prático como último item;
 *  3. a IA escreve só a justificativa, com texto por regra de reserva;
 *  4. o recorte é copiado para linhas do usuário (FR-03.2).
 *
 * Nenhum dos passos 1, 2 e 4 depende de serviço externo — a geração deixou de
 * poder falhar por erro de IA e de esperar por busca de links: os recursos já
 * estão na trilha (ou chegam depois, pela fila do TracksModule).
 *
 * Continua valendo a regra do CLAUDE.md §6: o controller nunca fala com a IA.
 */
@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);

  constructor(
    @InjectRepository(Track)
    private readonly tracks: Repository<Track>,
    private readonly justification: TrackJustificationService,
    private readonly userRoadmaps: UserRoadmapService,
  ) {}

  async generate(
    userId: string,
    input: WizardAnswers,
  ): Promise<RoadmapDetailDto> {
    const answers = this.normalize(input);
    const slug = chooseTrack(answers);

    const track = await this.tracks.findOne({
      where: { slug },
      relations: { modules: { topics: { resources: true } } },
    });
    if (!track) {
      // Só acontece se a carga das trilhas falhou no boot (ver TrackSyncService).
      this.logger.error(`Trilha "${slug}" não está no banco.`);
      throw new ServiceUnavailableException(
        'Esta trilha está indisponível no momento. Tente novamente em instantes.',
      );
    }

    const ordered = [...track.modules]
      .sort((a, b) => a.order - b.order)
      .map((module) => ({
        ...module,
        topics: [...module.topics].sort((a, b) => a.order - b.order),
      }));
    const plan = personalizeTrack(ordered, answers);

    const topics = plan.flatMap((module) => module.topics);
    const justification = await this.justification.write(answers, {
      area: slug,
      areaChosenByUser: answers.area !== UNDECIDED_AREA,
      moduleCount: plan.length,
      topicCount: topics.length,
      knownTopicCount: topics.filter((item) => item.alreadyKnown).length,
    });

    this.logger.log(
      `Roadmap por trilha "${slug}" — ${answers.weeklyTime}, ${topics.length} tópicos em ${plan.length} módulos.`,
    );

    return this.userRoadmaps.createFrom(userId, {
      targetArea: slug,
      justification,
      trackSlug: slug,
      answers,
      modules: plan.map(({ module, topics: moduleTopics }, moduleIndex) => ({
        title: module.title,
        description: module.description,
        // Reindexado: módulos e tópicos cortados não deixam buraco na ordem.
        order: moduleIndex,
        topics: [
          ...moduleTopics.map(({ topic, alreadyKnown }, topicIndex) => ({
            title: topic.title,
            order: topicIndex,
            estimatedHours: topic.estimatedHours,
            isCompleted: alreadyKnown,
            trackTopicId: topic.id,
            resources: [
              // Documentação oficial curada (Fase 2): vem do JSON, então já
              // existe mesmo enquanto a fila do YouTube não chegou no tópico.
              ...(topic.docs ?? []).map((doc) => ({
                title: doc.title,
                url: doc.url,
                type: 'article' as const,
                source: 'docs' as const,
              })),
              // Videoaulas curadas (`pnpm videos import`): também vêm do JSON.
              ...(topic.videos ?? []).map((video) => {
                const id = parseYoutubeVideoId(video.url);
                return {
                  title: video.title,
                  url: video.url,
                  type: 'video' as const,
                  source: 'youtube' as const,
                  ...(id ? { thumbnailUrl: youtubeThumbnailUrl(id) } : {}),
                };
              }),
              ...[...topic.resources]
                .sort((a, b) => a.order - b.order)
                // A mesma URL achada pela fila e curada no JSON vira uma linha
                // só (há UNIQUE por tópico + URL em topic_resources).
                .filter(
                  (resource) =>
                    !(topic.docs ?? []).some(
                      (doc) => doc.url === resource.url,
                    ) &&
                    !(topic.videos ?? []).some(
                      (video) => video.url === resource.url,
                    ),
                )
                .map((resource) => ({
                  title: resource.title,
                  url: resource.url,
                  type: resource.type,
                  source: resource.source,
                  ...(resource.thumbnailUrl
                    ? { thumbnailUrl: resource.thumbnailUrl }
                    : {}),
                })),
            ],
          })),
          // O projeto fecha o módulo, em todos os ritmos. Nunca nasce
          // concluído: saber a teoria não é ter construído.
          {
            kind: 'project' as const,
            title: module.projectTitle,
            description: module.projectDescription,
            order: moduleTopics.length,
            estimatedHours: module.projectHours,
          },
        ],
      })),
    });
  }

  /**
   * Respostas como serão guardadas no roadmap: objeto simples (o que chega é a
   * instância do DTO) e sem `affinity` para quem escolheu a área — ali ela não
   * decidiu nada, e guardá-la faria parecer que decidiu.
   */
  private normalize(input: WizardAnswers): WizardAnswers {
    return {
      goal: input.goal,
      area: input.area,
      ...(input.area === UNDECIDED_AREA && input.affinity
        ? { affinity: input.affinity }
        : {}),
      knownSkills: [...input.knownSkills],
      weeklyTime: input.weeklyTime,
      learningStyle: input.learningStyle,
    };
  }
}
