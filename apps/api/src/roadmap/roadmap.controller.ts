import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { RoadmapResponseDto } from '@estudeai/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WizardAnswersDto } from './dto/wizard-answers.dto';
import { RoadmapService } from './roadmap.service';

@Controller('roadmap')
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  /**
   * FR-01/FR-02.1 — recebe as respostas do wizard e devolve o roadmap sugerido.
   * Protegido pelo JWT guard da Etapa 2 (roadmap é vinculado ao usuário).
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  generate(@Body() dto: WizardAnswersDto): Promise<RoadmapResponseDto> {
    return this.roadmapService.generate(dto);
  }
}
