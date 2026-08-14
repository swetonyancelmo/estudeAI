import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  RoadmapDetailDto,
  RoadmapListItemDto,
  ToggleTopicResponseDto,
} from '@estudeai/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { WizardAnswersDto } from './dto/wizard-answers.dto';
import { RoadmapService } from './roadmap.service';
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
  ) {}

  /**
   * FR-01/FR-02.1 — recebe as respostas do wizard, resolve o conteúdo (cache ou
   * Gemini) e devolve o roadmap JÁ PERSISTIDO no usuário, com ids reais.
   */
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
}
