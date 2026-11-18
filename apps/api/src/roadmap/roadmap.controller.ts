import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  AdjustRoadmapResponseDto,
  ChallengeProgressDto,
  ChallengeSolutionDto,
  TopicChallengesDto,
  QuizAnswerResultDto,
  RoadmapStatsDto,
  QuizDto,
  ResourceProgressDto,
  RoadmapDetailDto,
  RoadmapListItemDto,
  ToggleTopicResponseDto,
  TopicNoteDto,
} from '@estudeai/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AdjustRoadmapDto } from './dto/adjust-roadmap.dto';
import { SaveChallengeDto } from './dto/save-challenge.dto';
import { StatsQueryDto, StudyTimeDto } from './dto/study.dto';
import { SubmitQuizAnswerDto } from './dto/submit-quiz-answer.dto';
import { UpdateResourceProgressDto } from './dto/update-resource-progress.dto';
import { UpdateTopicNoteDto } from './dto/update-topic-note.dto';
import { WizardAnswersDto } from './dto/wizard-answers.dto';
import { RoadmapService } from './roadmap.service';
import { RoadmapAdjustService } from './roadmap-adjust.service';
import { QuizService } from './quiz.service';
import { ChallengeService } from './challenge.service';
import { StudyService } from './study.service';
import { UserRoadmapService } from './user-roadmap.service';

/**
 * Todas as rotas exigem JWT: roadmap é sempre de alguém (FR-03.2). O usuário
 * vem do token (`@CurrentUser`), nunca do payload — o cliente não escolhe de
 * quem é o roadmap que está criando ou lendo.
 */
@Controller('roadmap')
@UseGuards(JwtAuthGuard)
export class RoadmapController {
  constructor(
    private readonly roadmapService: RoadmapService,
    private readonly userRoadmaps: UserRoadmapService,
    private readonly adjustService: RoadmapAdjustService,
    private readonly quizzes: QuizService,
    private readonly challenges: ChallengeService,
    private readonly study: StudyService,
  ) {}

  /**
   * FR-01/FR-02.1 — recebe as respostas do wizard, resolve o conteúdo (cache ou
   * Gemini) e devolve o roadmap JÁ PERSISTIDO no usuário, com ids reais.
   */
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // Máximo 5 gerações a cada 15 min
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: WizardAnswersDto,
  ): Promise<RoadmapDetailDto> {
    return this.roadmapService.generate(user.id, dto);
  }

  /** FR-03.2 — "Meus Roadmaps" do usuário autenticado, com % de progresso. */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RoadmapListItemDto[]> {
    return this.userRoadmaps.listForUser(user.id);
  }

  /** Detalhe completo. 404 se não existe, 403 se é de outro usuário. */
  @Get(':id')
  detail(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RoadmapDetailDto> {
    return this.userRoadmaps.findDetail(user.id, id);
  }

  /**
   * Exclui o roadmap (com módulos e tópicos, via cascade). 204 sem corpo: não
   * há o que devolver, e o cliente já sabe qual id removeu.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.userRoadmaps.remove(user.id, id);
  }

  /** FR-03.3 — marca/desmarca um tópico e devolve o progresso recalculado. */
  @Patch(':id/topics/:topicId')
  @HttpCode(HttpStatus.OK)
  toggleTopic(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
  ): Promise<ToggleTopicResponseDto> {
    return this.userRoadmaps.toggleTopic(user.id, id, topicId);
  }

  /** Sala de estudo — andamento num recurso (vídeo assistido, artigo lido). */
  @Patch(':id/topics/:topicId/resources/:resourceId')
  @HttpCode(HttpStatus.OK)
  updateResourceProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: UpdateResourceProgressDto,
  ): Promise<ResourceProgressDto> {
    return this.userRoadmaps.updateResourceProgress(
      user.id,
      id,
      topicId,
      resourceId,
      dto,
    );
  }

  /** Fase 3 — perguntas do quiz do tópico, sem o gabarito. */
  @Get(':id/topics/:topicId/quiz')
  getQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
  ): Promise<QuizDto> {
    return this.quizzes.getQuiz(user.id, id, topicId);
  }

  /** Fase 3 — corrige uma resposta, grava a tentativa e revela o gabarito. */
  @Post(':id/topics/:topicId/quiz/answers')
  @HttpCode(HttpStatus.OK)
  answerQuiz(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Body() dto: SubmitQuizAnswerDto,
  ): Promise<QuizAnswerResultDto> {
    return this.quizzes.answer(user.id, id, topicId, dto);
  }

  /** Fase 4 — desafios de código do tópico, com o código salvo da pessoa. */
  @Get(':id/topics/:topicId/challenges')
  listChallenges(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
  ): Promise<TopicChallengesDto> {
    return this.challenges.list(user.id, id, topicId);
  }

  /** Fase 4 — salva o código (autosave) e, se vier, o resultado dos testes. */
  @Put(':id/topics/:topicId/challenges/:challengeId')
  @HttpCode(HttpStatus.OK)
  saveChallenge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Param('challengeId', ParseUUIDPipe) challengeId: string,
    @Body() dto: SaveChallengeDto,
  ): Promise<ChallengeProgressDto> {
    return this.challenges.save(user.id, id, topicId, challengeId, dto);
  }

  /** Fase 4 — solução de referência do desafio. */
  @Get(':id/topics/:topicId/challenges/:challengeId/solution')
  challengeSolution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Param('challengeId', ParseUUIDPipe) challengeId: string,
  ): Promise<ChallengeSolutionDto> {
    return this.challenges.solution(user.id, id, topicId, challengeId);
  }

  /**
   * Fase 5 — "estou estudando": a sala de estudo avisa a cada minuto enquanto
   * está visível e em uso. Sem corpo na resposta.
   */
  @Post(':id/study-time')
  @HttpCode(HttpStatus.NO_CONTENT)
  recordStudyTime(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: StudyTimeDto,
  ): Promise<void> {
    return this.study.recordMinute(user.id, id, dto.day);
  }

  /** Fase 5 — painel de evolução do roadmap. */
  @Get(':id/stats')
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StatsQueryDto,
  ): Promise<RoadmapStatsDto> {
    return this.study.stats(user.id, id, query.today, query.tz);
  }

  /** Sala de estudo — anotação do tópico. */
  @Get(':id/topics/:topicId/note')
  getNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
  ): Promise<TopicNoteDto> {
    return this.userRoadmaps.getNote(user.id, id, topicId);
  }

  /** Sala de estudo — salva a anotação inteira (autosave). */
  @Put(':id/topics/:topicId/note')
  @HttpCode(HttpStatus.OK)
  updateNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('topicId', ParseUUIDPipe) topicId: string,
    @Body() dto: UpdateTopicNoteDto,
  ): Promise<TopicNoteDto> {
    return this.userRoadmaps.updateNote(user.id, id, topicId, dto.content);
  }

  /**
   * FR-04.1/FR-04.2 — reajusta ESTE roadmap (mesmo id) a partir de um pedido em
   * linguagem natural. 422 quando a IA devolve algo que alteraria progresso já
   * concluído: nesse caso nada é gravado.
   */
  @Throttle({ default: { limit: 5, ttl: 900000 } }) // Máximo 5 ajustes a cada 15 min
  @Post(':id/adjust')
  @HttpCode(HttpStatus.OK)
  adjust(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustRoadmapDto,
  ): Promise<AdjustRoadmapResponseDto> {
    return this.adjustService.adjust(user.id, id, dto.adjustmentRequest);
  }
}
