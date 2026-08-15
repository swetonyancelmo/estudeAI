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
  UseGuards,
} from '@nestjs/common';
import type {
  AdjustRoadmapResponseDto,
  RoadmapDetailDto,
  RoadmapListItemDto,
  ToggleTopicResponseDto,
} from '@estudeai/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AdjustRoadmapDto } from './dto/adjust-roadmap.dto';
import { WizardAnswersDto } from './dto/wizard-answers.dto';
import { RoadmapService } from './roadmap.service';
import { RoadmapAdjustService } from './roadmap-adjust.service';
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

  /**
   * FR-04.1/FR-04.2 — reajusta ESTE roadmap (mesmo id) a partir de um pedido em
   * linguagem natural. 422 quando a IA devolve algo que alteraria progresso já
   * concluído: nesse caso nada é gravado.
   */
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
